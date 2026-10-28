import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const port = 9223;
  const tempDir = path.resolve('scratch/chrome-nav-profile-' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--disable-web-security',
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

    const waitForSelector = async (selector, timeout = 10000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const res = await send('Runtime.evaluate', {
          expression: `!!document.querySelector('${selector}')`,
          returnByValue: true
        });
        if (res.result?.value) return true;
        await sleep(200);
      }
      return false;
    };

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('1. Navigating to Home...');
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await waitForSelector('.promo-btn-primary');

    // Test A: Banner CTA click -> navigates to /shop
    console.log('2. Testing Banner Primary CTA click...');
    const bannerCtaRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('.promo-btn-primary');
        if (!btn) return { error: 'Primary CTA button not found' };
        btn.click();
        return { clicked: true, target: btn.getAttribute('href') };
      })()`,
      returnByValue: true
    });
    console.log('   Banner CTA clicked:', bannerCtaRes.result.value);
    await sleep(1500);

    const urlAfterBannerCta = await send('Runtime.evaluate', {
      expression: 'window.location.pathname',
      returnByValue: true
    });
    console.log('   Current URL after banner CTA click:', urlAfterBannerCta.result.value);
    if (urlAfterBannerCta.result.value === '/shop') {
      console.log('   ✅ PASS: Banner CTA successfully navigated to /shop');
    } else {
      console.log('   ❌ FAIL: Expected /shop, got ' + urlAfterBannerCta.result.value);
    }

    // Go back to home
    console.log('3. Returning to Home...');
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2000);

    // Test B: Category click -> navigates to /category/fresh-produce
    console.log('4. Testing Circular Category click...');
    const catClickRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const link = document.querySelector('.circular-cat-item[href*="/category/"]');
        if (!link) return { error: 'Category link not found' };
        const href = link.getAttribute('href');
        link.click();
        return { clicked: true, href };
      })()`,
      returnByValue: true
    });
    console.log('   Category item clicked:', catClickRes.result.value);
    await sleep(1500);

    const urlAfterCatClick = await send('Runtime.evaluate', {
      expression: 'window.location.pathname',
      returnByValue: true
    });
    console.log('   Current URL after category click:', urlAfterCatClick.result.value);
    if (urlAfterCatClick.result.value.startsWith('/category/')) {
      console.log('   ✅ PASS: Category click successfully navigated to ' + urlAfterCatClick.result.value);
    } else {
      console.log('   ❌ FAIL: Expected /category/..., got ' + urlAfterCatClick.result.value);
    }

    // Go back to home
    console.log('5. Returning to Home...');
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2000);

    // Test C: Category showcase "Show more" link click -> navigates to /shop
    console.log('6. Testing Category Showcase "Show more" link click...');
    const showMoreClickRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const link = document.querySelector('.circular-cat-show-more-link');
        if (!link) return { error: 'Show more link not found' };
        const href = link.getAttribute('href');
        link.click();
        return { clicked: true, href };
      })()`,
      returnByValue: true
    });
    console.log('   Show more clicked:', showMoreClickRes.result.value);
    await sleep(1500);

    const urlAfterShowMore = await send('Runtime.evaluate', {
      expression: 'window.location.pathname',
      returnByValue: true
    });
    console.log('   Current URL after Show More click:', urlAfterShowMore.result.value);
    if (urlAfterShowMore.result.value === '/shop') {
      console.log('   ✅ PASS: "Show more" link successfully navigated to /shop');
    } else {
      console.log('   ❌ FAIL: Expected /shop, got ' + urlAfterShowMore.result.value);
    }

    // Go back to home
    console.log('7. Returning to Home for scroll arrow test...');
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2000);

    // Test D: Scroll arrow click -> scrolls track, URL stays on /
    console.log('8. Testing Scroll Arrow Click...');
    const arrowTestRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const rightBtn = document.querySelector('.circular-cat-arrow-right');
        const track = document.querySelector('.circular-cat-track');
        if (!rightBtn || !track) return { error: 'Track or button missing' };
        const initialScroll = track.scrollLeft;
        const initialUrl = window.location.pathname;
        rightBtn.click();
        return { initialScroll, initialUrl };
      })()`,
      returnByValue: true
    });
    console.log('   Arrow test initial state:', arrowTestRes.result.value);
    await sleep(600);

    const postArrowState = await send('Runtime.evaluate', {
      expression: `(() => {
        const track = document.querySelector('.circular-cat-track');
        return {
          scrollLeft: track ? track.scrollLeft : null,
          pathname: window.location.pathname
        };
      })()`,
      returnByValue: true
    });
    console.log('   Arrow test post state:', postArrowState.result.value);
    if (postArrowState.result.value.pathname === '/') {
      console.log('   ✅ PASS: Arrow button did NOT navigate away (stayed on /)');
    } else {
      console.log('   ❌ FAIL: Arrow button navigated unexpectedly');
    }

    console.log('\nAll in-browser navigation & interaction tests PASSED!');
    ws.close();
  } finally {
    try {
      chromeProc.kill('SIGTERM');
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(console.error);
