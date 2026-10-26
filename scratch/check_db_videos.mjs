import '../server/node_modules/dotenv/config.js';
import { pool } from '../server/db.js';

async function main() {
  const [rows] = await pool.query('SELECT * FROM product_videos');
  console.log('Videos count:', rows.length);
  const [prods] = await pool.query("SELECT id, title, price, image FROM products WHERE status = 'approved' LIMIT 5");
  console.log('Approved products:', prods.map(p => ({ id: p.id, title: p.title, price: p.price })));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
