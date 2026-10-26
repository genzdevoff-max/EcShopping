import https from 'https';

const testUrls = [
  { name: 'Video 1 MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
  { name: 'Video 2 MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' },
  { name: 'Video 3 MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4' },
  { name: 'Video 4 MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' },
  { name: 'Thumb 1 Unsplash', url: 'https://images.unsplash.com/photo-1611077543781-a96c138b1d98?auto=format&fit=crop&w=720&q=80' },
  { name: 'Thumb 2 Unsplash', url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=720&q=80' },
  { name: 'Thumb 3 Unsplash', url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=720&q=80' },
  { name: 'Thumb 4 Unsplash', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=720&q=80' }
];

async function checkUrl(item) {
  return new Promise((resolve) => {
    const req = https.request(item.url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      resolve({ name: item.name, status: res.statusCode, contentType: res.headers['content-type'], ok: res.statusCode === 200 });
    });
    req.on('error', (err) => resolve({ name: item.name, error: err.message, ok: false }));
    req.end();
  });
}

async function main() {
  const results = await Promise.all(testUrls.map(checkUrl));
  console.log(JSON.stringify(results, null, 2));
}

main();
