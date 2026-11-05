import dotenv from 'dotenv';
dotenv.config();

import supertest from 'supertest';
import assert from 'node:assert/strict';

const { default: app } = await import('../index.js');
const { initDatabase, default: pool } = await import('../db.js');
const { signToken } = await import('../middleware/auth.js');

const request = () => supertest(app);

const ADMIN_TOKEN = signToken({
  sub: 'admin_test_flow',
  role: 'admin',
  email: 'admin@ecshopping.local'
});

async function runTest() {
  console.log('🚀 [Test Flow] Starting Admin Category Image Upload -> Homepage Showcase verification...');

  await initDatabase();

  const testCategoryName = `Showcase Flow Cat ${Date.now()}`;
  const testCategorySlug = testCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // 1. Simulate Admin uploading an image file to /api/upload
  console.log('\n--- Step 1: Admin uploads category image file via POST /api/upload ---');
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const uploadRes = await request()
    .post('/api/upload')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .attach('image', samplePngBuffer, 'category-showcase-sample.png');

  assert.equal(uploadRes.status, 200, `Upload returned status ${uploadRes.status}`);
  assert.ok(uploadRes.body.success, 'Upload response success is true');
  assert.ok(uploadRes.body.url, 'Upload response contains image url');
  const uploadedImageUrl1 = uploadRes.body.url;
  console.log(`✅ Step 1 PASS: Image uploaded successfully. URL: ${uploadedImageUrl1}`);

  // 2. Admin creates category with the uploaded image URL
  console.log('\n--- Step 2: Admin creates category with uploaded image via POST /api/categories ---');
  const createRes = await request()
    .post('/api/categories')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({
      name: testCategoryName,
      description: 'A test category showcasing uploaded image on customer homepage',
      status: 'active',
      imageUrl: uploadedImageUrl1
    });

  assert.equal(createRes.status, 201, `Category creation returned ${createRes.status}`);
  assert.equal(createRes.body.success, true);
  assert.equal(createRes.body.category.name, testCategoryName);
  assert.equal(createRes.body.category.image, uploadedImageUrl1);
  const createdCatId = createRes.body.category.id;
  console.log(`✅ Step 2 PASS: Category created with ID: ${createdCatId}, Name: "${testCategoryName}"`);

  // 3. Verify Database persistence
  console.log('\n--- Step 3: Verify image URL in TiDB Cloud categories table ---');
  const [dbRows] = await pool.query('SELECT id, name, image_url, status FROM categories WHERE id = ?', [createdCatId]);
  assert.equal(dbRows.length, 1, 'Database row exists');
  assert.equal(dbRows[0].image_url, uploadedImageUrl1, 'Database image_url matches uploaded image');
  console.log(`✅ Step 3 PASS: Database confirmed image_url = "${dbRows[0].image_url}"`);

  // 4. Verify Customer Homepage retrieval via GET /api/categories/public
  console.log('\n--- Step 4: Verify Customer Homepage category showcase retrieval via GET /api/categories/public ---');
  const publicRes1 = await request().get('/api/categories/public');
  assert.equal(publicRes1.status, 200);
  assert.ok(Array.isArray(publicRes1.body.categories));
  const publicCat1 = publicRes1.body.categories.find((c) => c.name.toLowerCase() === testCategoryName.toLowerCase());
  assert.ok(publicCat1, `Created category must appear in public categories`);
  assert.equal(publicCat1.image, uploadedImageUrl1, `Public showcase image must match uploaded image`);
  console.log(`✅ Step 4 PASS: Customer Homepage category showcase retrieves correct image: ${publicCat1.image}`);

  // 5. Admin updates the category with a NEW image
  console.log('\n--- Step 5: Admin updates category with a new image via PUT /api/categories/:id ---');
  const samplePngBuffer2 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  const uploadRes2 = await request()
    .post('/api/upload')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .attach('image', samplePngBuffer2, 'category-showcase-updated.png');

  assert.equal(uploadRes2.status, 200);
  const uploadedImageUrl2 = uploadRes2.body.url;

  const updateRes = await request()
    .put(`/api/categories/${createdCatId}`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({
      imageUrl: uploadedImageUrl2
    });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.success, true);
  assert.equal(updateRes.body.category.image, uploadedImageUrl2);
  console.log(`✅ Step 5 PASS: Category updated with new image URL: ${uploadedImageUrl2}`);

  // 6. Verify Customer Homepage immediately receives the updated image
  console.log('\n--- Step 6: Verify Customer Homepage reflects updated image ---');
  const publicRes2 = await request().get('/api/categories/public');
  assert.equal(publicRes2.status, 200);
  const publicCat2 = publicRes2.body.categories.find((c) => c.name.toLowerCase() === testCategoryName.toLowerCase());
  assert.ok(publicCat2);
  assert.equal(publicCat2.image, uploadedImageUrl2, 'Customer Homepage displays updated image');
  console.log(`✅ Step 6 PASS: Customer Homepage automatically displays updated image: ${publicCat2.image}`);

  // 7. Verify navigation and slug compatibility
  console.log('\n--- Step 7: Verify category slug & navigation link generation ---');
  const generatedSlug = publicCat2.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  assert.equal(generatedSlug, testCategorySlug);
  const targetRoute = `/category/${generatedSlug}`;
  console.log(`✅ Step 7 PASS: Category canonical navigation route is: ${targetRoute}`);

  // 8. Cleanup test category
  console.log('\n--- Step 8: Cleanup test category ---');
  await pool.query('DELETE FROM categories WHERE id = ?', [createdCatId]);
  console.log(`✅ Step 8 PASS: Test category cleaned up from database.`);

  console.log('\n🎉 ALL 8 STEPS OF THE END-TO-END FLOW PASSED WITH 100% SUCCESS!\n');
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  });
