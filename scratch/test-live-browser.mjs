import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

function findChromePath() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Users/syedm/AppData/Local/Google/Chrome/Application/chrome.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function runBrowserTest() {
  const chromePath = findChromePath();
  if (!chromePath) {
    console.log('Chrome binary not found on standard paths, skipping browser screenshot.');
    return;
  }
  console.log('Found Chrome:', chromePath);

  const port = 9224;
  const userDataDir = path.resolve('scratch/chrome-test-profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    // Get websocket target
    const targets = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json`, res => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((res) => (ws.onopen = res));

    const sendCommand = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const currentId = id++;
        callbacks.set(currentId, { resolve, reject });
        ws.send(JSON.stringify({ id: currentId, method, params }));
      });

    const consoleLogs = [];
    ws.addEventListener('message', event => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.method === 'Runtime.consoleAPICalled') {
          consoleLogs.push({ type: parsed.params.type, text: parsed.params.args.map(a => a.value).join(' ') });
        }
      } catch {}
    });

    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to https://ecshopping.in ...');
    await sendCommand('Page.navigate', { url: 'https://ecshopping.in' });

    // Wait 5 seconds for page and API data to render
    await new Promise(r => setTimeout(r, 5000));

    // Evaluate title and DOM elements
    const titleRes = await sendCommand('Runtime.evaluate', { expression: 'document.title' });
    console.log('Page Title:', titleRes?.result?.value);

    const bannerCheck = await sendCommand('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector(".promo-banner-section"))'
    });
    console.log('Promotional Banner Present:', bannerCheck?.result?.value);

    const categoryCheck = await sendCommand('Runtime.evaluate', {
      expression: 'document.querySelectorAll(".circular-cat-item").length'
    });
    console.log('Circular Categories Rendered in Browser:', categoryCheck?.result?.value);

    const productCheck = await sendCommand('Runtime.evaluate', {
      expression: 'document.querySelectorAll(".pcard").length'
    });
    console.log('Product Cards Rendered in Browser:', productCheck?.result?.value);

    // Capture screenshot
    const screenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.resolve('scratch/ecshopping-live.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`✅ Saved live screenshot to ${screenshotPath}`);

    // Check for any critical console errors
    const errors = consoleLogs.filter(l => l.type === 'error');
    console.log(`Console Logs: ${consoleLogs.length} total, ${errors.length} errors`);
    if (errors.length > 0) {
      console.log('Console Errors:', errors);
    }

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

runBrowserTest().catch(err => {
  console.error('Browser test failed:', err);
});
