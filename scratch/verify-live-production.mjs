import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const port = 9345;
  const tempDir = path.resolve('scratch/chrome-profile-live-verification');
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

    console.log('\n========================================');
    console.log('PHASE 5: PRODUCTION VERIFICATION (LIVE)');
    console.log('========================================');

    // 1. Homepage & Storefront Verification
    console.log('\n[1/6] Testing Live Homepage: https://ecshopping.in/');
    await send('Page.navigate', { url: 'https://ecshopping.in/' });
    await sleep(3500);

    const homeEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const title = document.title;
        const banner = Boolean(document.querySelector('.promo-banner-section'));
        const circularCategories = document.querySelectorAll('.cat-showcase-item').length;
        const productCards = document.querySelectorAll('.product-card').length;
        const bodyScrollWidth = document.body.scrollWidth;
        const innerWidth = window.innerWidth;
        const hasHorizontalOverflow = bodyScrollWidth > innerWidth;
        return { title, banner, circularCategories, productCards, hasHorizontalOverflow };
      })()`,
      returnByValue: true
    });
    console.log('Homepage Result:', homeEval?.result?.value);

    // 2. Mobile Viewport Overflow Check (375px)
    console.log('\n[2/6] Testing Mobile Viewport (375x812)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(1500);

    const mobileEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const bodyScrollWidth = document.body.scrollWidth;
        const docScrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;
        const hasHorizontalOverflow = docScrollWidth > innerWidth + 1 || bodyScrollWidth > innerWidth + 1;
        return { bodyScrollWidth, docScrollWidth, innerWidth, hasHorizontalOverflow };
      })()`,
      returnByValue: true
    });
    console.log('Mobile 375px Result:', mobileEval?.result?.value);

    // Reset emulation to desktop
    await send('Emulation.clearDeviceMetricsOverride');

    // 3. PhonePe Return Flow: Case D (Missing orderId)
    console.log('\n[3/6] Testing Live PhonePe Return without orderId (Case D fallback)...');
    await send('Page.navigate', { url: 'https://ecshopping.in/payment/phonepe/return' });
    await sleep(2500);

    const returnMissingEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const hasStatusUnavailable = text.includes('Status unavailable');
        const hasCheckingPayment = text.includes('We’re checking your payment') || text.includes("We're checking your payment");
        const hasViewOrders = text.includes('View my orders');
        const hasTrackOrder = text.includes('Track an order');
        const cardHeading = document.querySelector('.ps-card strong')?.textContent?.trim();
        return { hasStatusUnavailable, hasCheckingPayment, hasViewOrders, hasTrackOrder, cardHeading };
      })()`,
      returnByValue: true
    });
    console.log('PhonePe Return (No orderId) Result:', returnMissingEval?.result?.value);

    // 4. PhonePe Return Flow: Direct Navigation & Refresh with Order Reference
    console.log('\n[4/6] Testing Live PhonePe Return with reference: https://ecshopping.in/payment/phonepe/return?orderId=ORD-999999');
    await send('Page.navigate', { url: 'https://ecshopping.in/payment/phonepe/return?orderId=ORD-999999' });
    await sleep(2500);

    const returnOrderIdEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const hasStatusUnavailable = text.includes('Status unavailable');
        const hasConfirming = text.includes('Confirming your payment') || text.includes('Checking payment details');
        const hasRef = text.includes('ORD-999999');
        const cardHeading = document.querySelector('.ps-card strong')?.textContent?.trim();
        return { hasStatusUnavailable, hasConfirming, hasRef, cardHeading };
      })()`,
      returnByValue: true
    });
    console.log('PhonePe Return (With orderId) Result:', returnOrderIdEval?.result?.value);

    // 5. Test Direct SPA Routes Navigation (Shop, Cart, Login, Orders)
    console.log('\n[5/6] Testing Direct SPA Routes Navigation...');
    const routes = ['/shop', '/cart', '/login', '/track-order'];
    const routeResults = {};
    for (const r of routes) {
      await send('Page.navigate', { url: `https://ecshopping.in${r}` });
      await sleep(2000);
      const evalR = await send('Runtime.evaluate', {
        expression: `document.title + ' | ' + (document.querySelector('main')?.textContent?.slice(0, 80) || '')`,
        returnByValue: true
      });
      routeResults[r] = evalR?.result?.value;
    }
    console.log('SPA Routes Results:', routeResults);

    // 6. Capture live screenshot of PhonePe return screen
    await send('Page.navigate', { url: 'https://ecshopping.in/payment/phonepe/return' });
    await sleep(2000);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scratch/screenshots/live-production-phonepe-return.png', Buffer.from(shot.data, 'base64'));
    console.log('\n[6/6] Saved live production screenshot to scratch/screenshots/live-production-phonepe-return.png');

    ws.close();
    console.log('\n✅ All Phase 5 Production Browser Tests Completed!');
  } finally {
    chromeProc.kill();
    await sleep(500);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(console.error);
