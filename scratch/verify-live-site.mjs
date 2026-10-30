async function check(url, expectedType = 'text/html') {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    const server = res.headers.get('server') || '';
    const referrerPolicy = res.headers.get('referrer-policy') || '';
    const xContentTypeOptions = res.headers.get('x-content-type-options') || '';

    const ok = res.status === 200 && contentType.includes(expectedType);
    console.log(`${ok ? '✅' : '❌'} [${res.status}] ${url}`);
    console.log(`   Content-Type: ${contentType} | Server: ${server} | Length: ${text.length}`);
    if (referrerPolicy) console.log(`   Referrer-Policy: ${referrerPolicy}`);
    if (xContentTypeOptions) console.log(`   X-Content-Type-Options: ${xContentTypeOptions}`);

    if (expectedType === 'text/html') {
      const hasRoot = text.includes('<div id="root"></div>');
      const hasTitle = text.includes('<title>EcShopping');
      const hasScript = text.includes('index-BWdC5_KN.js');
      console.log(`   HTML verification: hasRoot=${hasRoot}, hasTitle=${hasTitle}, hasScript=${hasScript}`);
    }
    return { ok, status: res.status, url };
  } catch (err) {
    console.log(`❌ ERROR fetching ${url}: ${err.message}`);
    return { ok: false, error: err.message, url };
  }
}

async function run() {
  console.log('=== Verifying ecshopping.in Live Deployment ===\n');

  console.log('--- 1. Root & SPA Routes Direct Refresh ---');
  await check('https://ecshopping.in/', 'text/html');
  await check('https://ecshopping.in/shop', 'text/html');
  await check('https://ecshopping.in/category/organic-vegetables', 'text/html');
  await check('https://ecshopping.in/cart', 'text/html');
  await check('https://ecshopping.in/checkout', 'text/html');
  await check('https://ecshopping.in/login', 'text/html');
  await check('https://ecshopping.in/admin', 'text/html');
  await check('https://ecshopping.in/vendor', 'text/html');
  await check('https://ecshopping.in/order-confirmation/ORD-TEST123', 'text/html');
  await check('https://ecshopping.in/payment/phonepe/return', 'text/html');

  console.log('\n--- 2. Static Assets Direct Serving ---');
  await check('https://ecshopping.in/assets/index-BWdC5_KN.js', 'javascript');
  await check('https://ecshopping.in/assets/index-D-RRukZj.css', 'css');
  await check('https://ecshopping.in/favicon.svg', 'svg');
  await check('https://ecshopping.in/placeholder.png', 'image');

  console.log('\n--- 3. Backend API Connectivity from ecshopping.in ---');
  const backendHealth = await fetch('https://ec-shopping-three.vercel.app/api/health').then(r => r.json());
  console.log('Backend /api/health:', backendHealth);

  const publicCategories = await fetch('https://ec-shopping-three.vercel.app/api/categories/public').then(r => r.json());
  console.log('Public Categories Count:', publicCategories.categories?.length || 0);

  const publicProducts = await fetch('https://ec-shopping-three.vercel.app/api/products').then(r => r.json());
  console.log('Public Products Count:', publicProducts.products?.length || 0);
}

run();
