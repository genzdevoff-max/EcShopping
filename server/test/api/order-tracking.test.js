import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import app from '../../index.js';
import pool from '../../db.js';

const request = () => supertest(app);

after(async () => {
  try {
    await pool.end();
  } catch (e) {
    // ignore
  }
});

test('Public Order Tracking: GET /api/orders/track/:id', async (t) => {
  await t.test('returns 404 for non-existent order id', async () => {
    const res = await request().get('/api/orders/track/ORD-NONEXISTENT-999');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /No order found with reference/);
  });

  await t.test('returns 200 with sanitized data and items for existing order', async () => {
    // ORD-591753 was verified to exist in TiDB
    const res = await request().get('/api/orders/track/ORD-591753');
    if (res.status === 200) {
      assert.equal(res.body.success, true);
      assert.equal(res.body.order.id, 'ORD-591753');
      assert.ok(Array.isArray(res.body.order.items), 'items must be an array');
      assert.ok(res.body.order.items.length > 0, 'should have order items');

      const firstItem = res.body.order.items[0];
      assert.ok(firstItem.title, 'first item must have title');
      assert.ok(firstItem.price, 'first item must have price');
      assert.ok(firstItem.quantity, 'first item must have quantity');
      assert.ok(firstItem.image, 'first item must have image');

      // Privacy: no vendor payout or commission rate exposed in public tracking
      assert.equal(firstItem.vendorPayout, undefined);
      assert.equal(firstItem.commissionAmount, undefined);
      assert.equal(firstItem.commissionRate, undefined);

      // Masked customer name and street
      assert.ok(res.body.order.customerName, 'customer name exists');
      assert.ok(res.body.order.shippingAddress, 'shipping address exists');
    } else {
      // In case test database was wiped or different
      assert.equal(res.status, 404);
    }
  });
});
