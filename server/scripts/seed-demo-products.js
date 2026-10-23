import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../db.js';

const seedCategories = [
  { id: 'cat_produce', name: 'Fresh Produce', description: 'Farm-fresh vegetables, fruits, and organic greens' },
  { id: 'cat_pantry', name: 'Pantry Staples', description: 'Wood-pressed oils, stone-ground flours, and spices' },
  { id: 'cat_dairy', name: 'Dairy & Eggs', description: 'Grass-fed cow milk, organic ghee, and country eggs' },
  { id: 'cat_honey', name: 'Honey & Sweeteners', description: 'Wild forest honey, palm jaggery, and unrefined sugars' }
];

const seedProducts = [
  {
    id: 'prod_coconut_oil_1l',
    title: 'Wood-Pressed Coconut Oil (1L)',
    name: 'Wood-Pressed Coconut Oil (1L)',
    description: 'Cold-pressed from fresh copra with no heat or chemicals. Retains natural antioxidants, aroma, and essential fatty acids.',
    category: 'Pantry Staples',
    price: 340,
    strike_price: 399,
    unit: '1 Litre',
    image: 'https://images.unsplash.com/photo-1611077543781-a96c138b1d98?auto=format&fit=crop&w=700&q=80',
    stock_status: 'in_stock',
    stock_quantity: 85,
    status: 'approved',
    vendor_id: 'v1792315870969',
    vendor_name: 'Rishi Aravindha'
  },
  {
    id: 'prod_wild_honey_500g',
    title: 'Raw Forest Honey (500g)',
    name: 'Raw Forest Honey (500g)',
    description: 'Pure multi-floral raw honey ethically harvested from wild hives in the Western Ghats. Unheated and unfiltered.',
    category: 'Honey & Sweeteners',
    price: 420,
    strike_price: 490,
    unit: '500g',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=700&q=80',
    stock_status: 'in_stock',
    stock_quantity: 45,
    status: 'approved',
    vendor_id: 'v1792315870969',
    vendor_name: 'Rishi Aravindha'
  },
  {
    id: 'prod_palm_jaggery_500g',
    title: 'Organic Palm Jaggery Powder (500g)',
    name: 'Organic Palm Jaggery Powder (500g)',
    description: 'Traditional unrefined palm sugar powder packed with natural iron, magnesium, and minerals. Perfect for tea and desserts.',
    category: 'Honey & Sweeteners',
    price: 185,
    strike_price: 210,
    unit: '500g',
    image: 'https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?auto=format&fit=crop&w=700&q=80',
    stock_status: 'in_stock',
    stock_quantity: 60,
    status: 'approved',
    vendor_id: 'v1792315870969',
    vendor_name: 'Rishi Aravindha'
  },
  {
    id: 'prod_country_eggs_12',
    title: 'Free-Range Country Eggs (Pack of 12)',
    name: 'Free-Range Country Eggs (Pack of 12)',
    description: 'Fresh free-range country eggs from pasture-raised hens fed a natural grain and vegetable diet. Rich golden yolks.',
    category: 'Dairy & Eggs',
    price: 140,
    strike_price: 160,
    unit: '12 eggs',
    image: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?auto=format&fit=crop&w=700&q=80',
    stock_status: 'in_stock',
    stock_quantity: 30,
    status: 'approved',
    vendor_id: 'v1792315870969',
    vendor_name: 'Rishi Aravindha'
  },
  {
    id: 'prod_farm_tomatoes_1kg',
    title: 'Naturally Grown Country Tomatoes (1kg)',
    name: 'Naturally Grown Country Tomatoes (1kg)',
    description: 'Juicy, vine-ripened country tomatoes harvested the morning of dispatch. Chemical fertilizer-free cultivation.',
    category: 'Fresh Produce',
    price: 45,
    strike_price: 55,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=700&q=80',
    stock_status: 'in_stock',
    stock_quantity: 120,
    status: 'approved',
    vendor_id: 'v1792315870969',
    vendor_name: 'Rishi Aravindha'
  },
  {
    id: 'prod_desi_ghee_500ml',
    title: 'A2 Desi Cow Cultured Ghee (500ml)',
    name: 'A2 Desi Cow Cultured Ghee (500ml)',
    description: 'Bilona-churned traditional A2 desi cow ghee made from whole curd. Granular texture, aromatic fragrance, and high smoke point.',
    category: 'Dairy & Eggs',
    price: 650,
    strike_price: 750,
    unit: '500ml',
    image: 'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&w=700&q=80',
    stock_status: 'in_stock',
    stock_quantity: 25,
    status: 'approved',
    vendor_id: 'v1792315870969',
    vendor_name: 'Rishi Aravindha'
  },
  {
    id: 'prod_red_rice_1kg',
    title: 'Traditional Red Rice (Kattuyanam - 1kg)',
    name: 'Traditional Red Rice (Kattuyanam - 1kg)',
    description: 'Ancient heritage red rice rich in anthocyanins, zinc, and dietary fiber. Low glycemic index and hearty nutty flavor.',
    category: 'Pantry Staples',
    price: 135,
    strike_price: 155,
    unit: '1 kg',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=700&q=80',
    stock_status: 'in_stock',
    stock_quantity: 70,
    status: 'approved',
    vendor_id: 'v1792315870969',
    vendor_name: 'Rishi Aravindha'
  },
  {
    id: 'prod_fresh_spinach_bunch',
    title: 'Hydroponic Tender Baby Spinach (250g)',
    name: 'Hydroponic Tender Baby Spinach (250g)',
    description: 'Crisp, tender baby spinach leaves grown pesticide-free in clean water. Cleaned, pre-trimmed, and ready to cook or blend.',
    category: 'Fresh Produce',
    price: 50,
    strike_price: null,
    unit: '250g',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=700&q=80',
    stock_status: 'in_stock',
    stock_quantity: 40,
    status: 'approved',
    vendor_id: 'v1792315870969',
    vendor_name: 'Rishi Aravindha'
  }
];

async function run() {
  for (const c of seedCategories) {
    const [existing] = await pool.query('SELECT id FROM categories WHERE name = ?', [c.name]);
    if (existing.length === 0) {
      await pool.query('INSERT INTO categories (id, vendor_id, name, description, status) VALUES (?, NULL, ?, ?, ?)', [c.id, c.name, c.description, 'active']);
      console.log('Seeded category:', c.name);
    }
  }

  for (const p of seedProducts) {
    const [existing] = await pool.query('SELECT id FROM products WHERE id = ?', [p.id]);
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO products (id, vendor_id, vendor_name, title, name, description, category, price, strike_price, unit, image, stock_status, stock_quantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.vendor_id, p.vendor_name, p.title, p.name, p.description, p.category, p.price, p.strike_price, p.unit, p.image, p.stock_status, p.stock_quantity, p.status]
      );
      console.log('Seeded product:', p.title);
    }
  }

  const [finalCount] = await pool.query('SELECT count(*) as cnt FROM products');
  console.log('Total products in database now:', finalCount[0].cnt);
  await pool.end();
}

run().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
