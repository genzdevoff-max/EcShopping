import { pool } from '../server/db.js';

async function main() {
  const [existing] = await pool.query('SELECT COUNT(*) AS c FROM product_videos');
  if (existing[0].c === 0) {
    const seed = [
      {
        id: 'vid_coconut_oil',
        title: 'How Wood-Pressed Coconut Oil is Extracted',
        description: 'Watch the traditional wood chekku process that preserves natural nutrients and aroma without heat.',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1611077543781-a96c138b1d98?auto=format&fit=crop&w=720&q=80',
        product_id: 'prod_coconut_oil_1l',
        status: 'active',
        display_order: 1
      },
      {
        id: 'vid_country_eggs',
        title: 'Free-Range Pastured Eggs Harvest',
        description: 'Ethically raised hens foraging on fresh pastures for golden, nutrient-rich yolks.',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=720&q=80',
        product_id: 'prod_country_eggs_12',
        status: 'active',
        display_order: 2
      },
      {
        id: 'vid_desi_ghee',
        title: 'Traditional Bilona A2 Desi Cow Ghee',
        description: 'Cultured curd hand-churned in earthen pots to create pure granular aromatic ghee.',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=720&q=80',
        product_id: 'prod_desi_ghee_500ml',
        status: 'active',
        display_order: 3
      },
      {
        id: 'vid_tomatoes',
        title: 'Naturally Ripened Country Tomatoes',
        description: 'Sun-kissed native heirloom tomatoes picked fresh daily from pesticide-free fields.',
        video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=720&q=80',
        product_id: 'prod_farm_tomatoes_1kg',
        status: 'active',
        display_order: 4
      }
    ];

    for (const v of seed) {
      await pool.query(
        `INSERT INTO product_videos (id, title, description, video_url, thumbnail_url, product_id, status, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.title, v.description, v.video_url, v.thumbnail_url, v.product_id, v.status, v.display_order]
      );
    }
    console.log('✅ Seeded 4 product videos successfully');
  } else {
    console.log('Videos already present:', existing[0].c);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
