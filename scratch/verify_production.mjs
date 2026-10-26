import https from 'https';

async function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('--- 1. Fetching https://ec-shopping.vercel.app/ ---');
  const feRes = await fetchUrl('https://ec-shopping.vercel.app/');
  console.log('Frontend Status:', feRes.status);
  console.log('Frontend Headers:', {
    'last-modified': feRes.headers['last-modified'],
    'etag': feRes.headers['etag'],
    'age': feRes.headers['age'],
    'x-vercel-id': feRes.headers['x-vercel-id']
  });

  // Extract JS bundle links
  const scriptMatches = [...feRes.body.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
  console.log('Script tags in HTML:', scriptMatches);

  for (const scriptPath of scriptMatches) {
    const fullScriptUrl = scriptPath.startsWith('http') ? scriptPath : `https://ec-shopping.vercel.app${scriptPath}`;
    console.log(`\n--- Fetching script: ${fullScriptUrl} ---`);
    const sRes = await fetchUrl(fullScriptUrl);
    console.log('Script Status:', sRes.status);
    console.log('Script Length:', sRes.body.length);
    console.log('Script Headers:', {
      'last-modified': sRes.headers['last-modified'],
      'etag': sRes.headers['etag'],
      'age': sRes.headers['age']
    });

    const hasRender = sRes.body.includes('ecshopping.onrender.com');
    const hasVercelThree = sRes.body.includes('ec-shopping-three.vercel.app');
    const hasLocalhost = sRes.body.includes('localhost:5000');
    console.log('Contains ecshopping.onrender.com:', hasRender);
    console.log('Contains ec-shopping-three.vercel.app:', hasVercelThree);
    console.log('Contains localhost:5000:', hasLocalhost);

    // Look for API_URL or VITE_API_URL or endpoint base
    const renderMatches = [...sRes.body.matchAll(/https?:\/\/[a-zA-Z0-9.-]+\.vercel\.app/g)].map(m => m[0]);
    console.log('Vercel URLs found in bundle:', [...new Set(renderMatches)]);
    const otherUrls = [...sRes.body.matchAll(/https?:\/\/[a-zA-Z0-9.-]+\.onrender\.com/g)].map(m => m[0]);
    console.log('Render URLs found in bundle:', [...new Set(otherUrls)]);
  }

  console.log('\n--- 2. Checking Backend: https://ec-shopping-three.vercel.app ---');
  const beHealth = await fetchUrl('https://ec-shopping-three.vercel.app/');
  console.log('Backend root status:', beHealth.status, beHealth.body.slice(0, 150));

  const beCat = await fetchUrl('https://ec-shopping-three.vercel.app/api/categories/public');
  console.log('Backend categories status:', beCat.status, 'Body preview:', beCat.body.slice(0, 200));

  const beProd = await fetchUrl('https://ec-shopping-three.vercel.app/api/products');
  console.log('Backend products status:', beProd.status, 'Body preview:', beProd.body.slice(0, 200));

  // CORS check with Origin header
  console.log('\n--- 3. Checking CORS ---');
  const corsRes = await fetchUrl('https://ec-shopping-three.vercel.app/api/categories/public', {
    'Origin': 'https://ec-shopping.vercel.app'
  });
  console.log('CORS response headers:', {
    'access-control-allow-origin': corsRes.headers['access-control-allow-origin'],
    'access-control-allow-credentials': corsRes.headers['access-control-allow-credentials']
  });

  // Check videos public endpoint on backend
  console.log('\n--- 4. Checking Videos API on Backend ---');
  const beVideos = await fetchUrl('https://ec-shopping-three.vercel.app/api/videos/public');
  console.log('Backend videos status:', beVideos.status, 'Body preview:', beVideos.body.slice(0, 250));
}

main().catch(console.error);
