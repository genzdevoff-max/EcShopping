import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const port = 9338;
  const tempDir = path.resolve('scratch/chrome-profile-verify-phonepe');
  fs.mkdirSync(tempDir, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  try {
    let cdpInfo = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const json = await new Promise((res, rej) => {
          http.get(`http://127.0.0.1:${port}/json`, (r) => {
            let data = '';
            r.on('data', (c) => (data += c));
            r.on('end', () => res(JSON.parse(data)));
          }).on('error', rej);
        });
        if (json && json.length > 0) {
          cdpInfo = json.find((t) => t.type === 'page') || json[0];
          if (cdpInfo && cdpInfo.type === 'page') break;
        }
      } catch {}
    }

    if (!cdpInfo) throw new Error('Could not connect to Chrome CDP');

    const ws = new WebSocket(cdpInfo.webSocketDebuggerUrl);
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

    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const currentId = id++;
        callbacks.set(currentId, { resolve, reject });
        ws.send(JSON.stringify({ id: currentId, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('\n--- Test 1: Missing orderId (Case D fallback) ---');
    await send('Page.navigate', { url: 'http://localhost:5190/payment/phonepe/return' });
    await sleep(2000);

    const res1 = await send('Runtime.evaluate', {
      expression: `(() => {
        const bodyText = document.body.innerText;
        return {
          hasStatusUnavailable: bodyText.includes('Status unavailable'),
          hasCheckingPayment: bodyText.includes('We’re checking your payment') || bodyText.includes("We're checking your payment"),
          hasViewOrders: bodyText.includes('View my orders'),
          hasTrackOrder: bodyText.includes('Track an order'),
          heading: document.querySelector('.pay-state strong')?.textContent?.trim()
        };
      })()`,
      returnByValue: true
    });
    console.log('Test 1 (No orderId) result:', res1?.result?.value);

    console.log('\n--- Test 2: With orderId (Initial confirmation & retry loop) ---');
    await send('Page.navigate', { url: 'http://localhost:5190/payment/phonepe/return?orderId=ORD-456789' });
    await sleep(1500);

    const res2 = await send('Runtime.evaluate', {
      expression: `(() => {
        const bodyText = document.body.innerText;
        return {
          hasStatusUnavailable: bodyText.includes('Status unavailable'),
          hasConfirming: bodyText.includes('Confirming your payment…') || bodyText.includes('Checking payment details'),
          hasOrderIdRef: bodyText.includes('Ref: ORD-456789'),
          heading: document.querySelector('.pay-state strong')?.textContent?.trim(),
          buttonText: document.querySelector('.ps-actions button')?.textContent?.trim()
        };
      })()`,
      returnByValue: true
    });
    console.log('Test 2 (With orderId) result:', res2?.result?.value);

    // Take screenshot of Test 2
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/screenshots/phonepe-return-screen.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved screenshot to scratch/screenshots/phonepe-return-screen.png');

    ws.close();
  } finally {
    chromeProc.kill();
    await sleep(500);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(console.error);
