import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-320', width: 320, height: 568 }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const port = 9222;
  const tempDir = path.resolve('scratch/chrome-profile-' + Date.now());
  const screenshotsDir = path.resolve('scratch/screenshots');
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(screenshotsDir, { recursive: true });

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
          if (cdpInfo && cdpInfo.type === 'page') {
            break;
          }
        }
      } catch {}
    }

    if (!cdpInfo) throw new Error('Could not connect to Chrome CDP');

    console.log('Connected to Chrome tab:', cdpInfo.title, cdpInfo.url);
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
    await send('DOM.enable');

    console.log('Navigating to http://localhost:5173/ ...');
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2500);

    const results = [];

    for (const vp of VIEWPORTS) {
      console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})`);

      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768
      });

      await sleep(1000);

      // Evaluate layout metrics & elements
      const evalRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const bodyScrollWidth = document.body.scrollWidth;
          const docScrollWidth = document.documentElement.scrollWidth;
          const innerWidth = window.innerWidth;
          const hasHorizontalOverflow = docScrollWidth > innerWidth + 1 || bodyScrollWidth > innerWidth + 1;

          const banner = document.querySelector('.promo-banner-section');
          const bannerTitle = banner ? banner.querySelector('.promo-banner-title')?.textContent?.trim() : null;
          const primaryCta = banner ? banner.querySelector('.promo-btn-primary')?.getAttribute('href') : null;
          const secondaryCta = banner ? banner.querySelector('.promo-btn-secondary')?.getAttribute('href') : null;

          const showcase = document.querySelector('.circular-category-showcase');
          const showcaseTitle = showcase ? showcase.querySelector('.circular-cat-title')?.textContent?.trim() : null;
          const showMoreLink = showcase ? showcase.querySelector('.circular-cat-show-more-link')?.getAttribute('href') : null;
          const catItems = showcase ? Array.from(showcase.querySelectorAll('.circular-cat-item')).map(el => ({
            label: el.querySelector('.circular-cat-label')?.textContent?.trim(),
            href: el.getAttribute('href'),
            isAll: el.classList.contains('circular-cat-all-tile')
          })) : [];

          const circularImages = showcase ? Array.from(showcase.querySelectorAll('.circular-cat-media img')).map(img => ({
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            complete: img.complete
          })) : [];

          return {
            innerWidth,
            docScrollWidth,
            hasHorizontalOverflow,
            bannerPresent: !!banner,
            bannerTitle,
            primaryCta,
            secondaryCta,
            showcasePresent: !!showcase,
            showcaseTitle,
            showMoreLink,
            categoryCount: catItems.length,
            categories: catItems,
            imagesLoaded: circularImages.filter(i => i.complete && i.naturalWidth > 0).length,
            totalImages: circularImages.length
          };
        })()`,
        returnByValue: true
      });

      const data = evalRes.result?.value;
      console.log(`- Horizontal overflow: ${data.hasHorizontalOverflow ? 'FAIL (overflow detected)' : 'PASS (no overflow)'}`);
      console.log(`- Banner: ${data.bannerPresent ? 'PASS (' + data.bannerTitle + ')' : 'FAIL'}`);
      console.log(`- Banner Primary CTA: ${data.primaryCta}`);
      console.log(`- Circular Showcase: ${data.showcasePresent ? 'PASS (' + data.showcaseTitle + ')' : 'FAIL'}`);
      console.log(`- Showcase "Show more" link: ${data.showMoreLink}`);
      console.log(`- Category Items: ${data.categoryCount} items rendered`);
      console.log(`- Images loaded: ${data.imagesLoaded}/${data.totalImages}`);

      // Capture screenshot
      const shotRes = await send('Page.captureScreenshot', { format: 'png' });
      if (shotRes?.data) {
        const filePath = path.join(screenshotsDir, `homepage-${vp.name}.png`);
        fs.writeFileSync(filePath, Buffer.from(shotRes.data, 'base64'));
        console.log(`- Screenshot saved: ${filePath}`);
      }

      results.push({ viewport: vp.name, ...data });
    }

    fs.writeFileSync(
      path.join(screenshotsDir, 'viewport-qa-summary.json'),
      JSON.stringify(results, null, 2),
      'utf8'
    );
    console.log('\nAll viewport tests completed successfully! Results written to scratch/screenshots/viewport-qa-summary.json');

    ws.close();
  } finally {
    try {
      chromeProc.kill('SIGTERM');
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(console.error);
