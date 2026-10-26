import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

process.env.DB_NAME = 'ecshopping_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_unit_tests_only_32_chars_long';

const { default: app } = await import('../../index.js');
const { initDatabase, pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');

const request = supertest(app);

const adminToken = signToken({ sub: 'admin_1', role: 'admin', email: 'admin@ecshopping.test', name: 'Admin Test' });
const vendorAToken = signToken({ sub: 'v_del_test_a', role: 'vendor', email: 'vendora@test.com', name: 'Vendor A' });
const vendorBToken = signToken({ sub: 'v_del_test_b', role: 'vendor', email: 'vendorb@test.com', name: 'Vendor B' });
const customerToken = signToken({ sub: 'cust_del_test', role: 'customer', email: 'cust@test.com', name: 'Customer' });

const testProductA = 'prod_del_a_' + Date.now();
const testProductB = 'prod_del_b_' + Date.now();
const testProductHist = 'prod_del_hist_' + Date.now();
const testOrderId = 'ord_del_hist_' + Date.now();

before(async () => {
  await initDatabase();

  // Create products
  await pool.query(
    `INSERT INTO products (id, vendor_id, vendor_name, title, name, price, stock_quantity, status)
     VALUES (?, 'v_del_test_a', 'Vendor A', 'Vendor A Herb Pack', 'Vendor A Herb Pack', 150, 10, 'approved'),
            (?, 'v_del_test_b', 'Vendor B', 'Vendor B Spices', 'Vendor B Spices', 250, 20, 'pending'),
            (?, 'v_del_test_a', 'Vendor A', 'Historical Item', 'Historical Item', 300, 5, 'approved')`,
    [testProductA, testProductB, testProductHist]
  );

  // Create historical order and order_item referencing testProductHist
  await pool.query(
    `INSERT INTO orders (id, customer_email, total, status)
     VALUES (?, 'cust@test.com', 300, 'Delivered')`,
    [testOrderId]
  );
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, vendor_id, vendor_name, title, price, quantity)
     VALUES (?, ?, 'v_del_test_a', 'Vendor A', 'Historical Item', 300, 1)`,
    [testOrderId, testProductHist]
  );
});

after(async () => {
  await pool.query('DELETE FROM order_items WHERE order_id = ?', [testOrderId]);
  await pool.query('DELETE FROM orders WHERE id = ?', [testOrderId]);
  await pool.query('DELETE FROM products WHERE id IN (?, ?, ?)', [testProductA, testProductB, testProductHist]);
  await pool.end();
});

test('Feature C: Customer cannot delete vendor products (403)', async () => {
  const res = await request
    .delete(`/api/products/${testProductA}`)
    .set('Authorization', `Bearer ${customerToken}`);

  assert.equal(res.status, 403);
});

test('Feature C: Unauthenticated request cannot delete products (401)', async () => {
  const res = await request.delete(`/api/products/${testProductA}`);
  assert.equal(res.status, 401);
});

test('Feature C: Vendor A cannot delete Vendor B product (403)', async () => {
  const res = await request
    .delete(`/api/products/${testProductB}`)
    .set('Authorization', `Bearer ${vendorAToken}`);

  assert.equal(res.status, 403);
  assert.match(res.body.error, /own products/i);
});

test('Feature C: Admin can remove any vendor product (200)', async () => {
  const res = await request
    .delete(`/api/products/${testProductB}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // Verify removed from database
  const [rows] = await pool.query('SELECT id FROM products WHERE id = ?', [testProductB]);
  assert.equal(rows.length, 0, 'Product must be deleted from database');
});

test('Feature C: Vendor can delete their own product (200)', async () => {
  const res = await request
    .delete(`/api/products/${testProductA}`)
    .set('Authorization', `Bearer ${vendorAToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const [rows] = await pool.query('SELECT id FROM products WHERE id = ?', [testProductA]);
  assert.equal(rows.length, 0);
});

test('Feature C: Deleting product preserves historical order items', async () => {
  // Admin deletes the product that is part of historical order
  const delRes = await request
    .delete(`/api/products/${testProductHist}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(delRes.status, 200);

  // Verify order and order_items still exist and are completely readable
  const [orderRows] = await pool.query('SELECT id, total, status FROM orders WHERE id = ?', [testOrderId]);
  assert.equal(orderRows.length, 1);
  assert.equal(orderRows[0].status, 'Delivered');

  const [itemRows] = await pool.query('SELECT title, price, quantity FROM order_items WHERE order_id = ?', [testOrderId]);
  assert.equal(itemRows.length, 1);
  assert.equal(itemRows[0].title, 'Historical Item');
  assert.equal(Number(itemRows[0].price), 300);
});
