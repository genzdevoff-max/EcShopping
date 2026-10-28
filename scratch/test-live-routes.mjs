import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

function findChromePath() {
  return 'C:/Program Files/Google/Chrome/Application/chrome.exe';
}

async function runRoutesTest() {
  const chromePath = findChromePath();
  const port = 9225;
  const userDataDir = path.resolve('scratch/chrome-routes-profile');
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
    const targets = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/json`, res => {
        let body = '';
        res.on('data', d => { body += d; });
        res.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.type === 'page');
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

    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');

    const routes = [
      { url: 'https://ecshopping.in/shop', check: 'document.querySelectorAll(".pcard").length > 0', name: 'Shop Catalog' },
      { url: 'https://ecshopping.in/cart', check: 'document.body.innerText.includes("Cart") || document.body.innerText.includes("cart")', name: 'Cart' },
      { url: 'https://ecshopping.in/login', check: 'document.querySelector("input[type=\'email\']") !== null', name: 'Customer Login' },
      { url: 'https://ecshopping.in/admin', check: 'document.querySelector("input[type=\'email\']") !== null || document.body.innerText.includes("Admin")', name: 'Admin Portal' },
      { url: 'https://ecshopping.in/vendor', check: 'document.querySelector("input[type=\'email\']") !== null || document.body.innerText.includes("Vendor")', name: 'Vendor Portal' }
    ];

    for (const r of routes) {
      process.stdout.write(`Testing live route ${r.name} (${r.url})... `);
      await sendCommand('Page.navigate', { url: r.url });
      await new Promise(res => setTimeout(res, 3000));
      const evalRes = await sendCommand('Runtime.evaluate', { expression: r.check });
      const pass = Boolean(evalRes?.result?.value);
      console.log(pass ? '✅ PASS' : '❌ FAIL');
    }

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

runRoutesTest().catch(console.error);
