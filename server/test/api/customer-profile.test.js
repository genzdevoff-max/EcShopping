process.env.DB_NAME = 'ecshopping_test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../../index.js');
const { initDatabase, default: pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');
const { hashPassword } = await import('../../utils/passwords.js');

const request = () => supertest(app);

const CUSTOMER_A = {
  id: 'usr_test_cust_a',
  name: 'Customer Alice',
  email: 'alice@test.local',
  password: 'alice-password-123',
  phone: '9876543210'
};

const CUSTOMER_B = {
  id: 'usr_test_cust_b',
  name: 'Customer Bob',
  email: 'bob@test.local',
  password: 'bob-password-456',
  phone: '9876543211'
};

let tokenA;
let tokenB;

before(async () => {
  await initDatabase();
  await pool.query("DELETE FROM customer_addresses WHERE user_id IN (?, ?)", [CUSTOMER_A.id, CUSTOMER_B.id]);
  await pool.query("DELETE FROM users WHERE id IN (?, ?)", [CUSTOMER_A.id, CUSTOMER_B.id]);

  const hashA = await hashPassword(CUSTOMER_A.password);
  const hashB = await hashPassword(CUSTOMER_B.password);

  await pool.query(
    "INSERT INTO users (id, name, email, password, password_hash, phone) VALUES (?, ?, ?, '', ?, ?)",
    [CUSTOMER_A.id, CUSTOMER_A.name, CUSTOMER_A.email, hashA, CUSTOMER_A.phone]
  );
  await pool.query(
    "INSERT INTO users (id, name, email, password, password_hash, phone) VALUES (?, ?, ?, '', ?, ?)",
    [CUSTOMER_B.id, CUSTOMER_B.name, CUSTOMER_B.email, hashB, CUSTOMER_B.phone]
  );

  tokenA = signToken({ sub: CUSTOMER_A.id, role: 'customer', email: CUSTOMER_A.email });
  tokenB = signToken({ sub: CUSTOMER_B.id, role: 'customer', email: CUSTOMER_B.email });
});

after(async () => {
  await pool.query("DELETE FROM customer_addresses WHERE user_id IN (?, ?)", [CUSTOMER_A.id, CUSTOMER_B.id]);
  await pool.query("DELETE FROM users WHERE id IN (?, ?)", [CUSTOMER_A.id, CUSTOMER_B.id]);
  await pool.end();
});

test('Customer Profile & Address: Authentication enforcement', async () => {
  const getRes = await request().get('/api/user/profile');
  assert.equal(getRes.status, 401, 'Profile GET without token must be 401');

  const putRes = await request().put('/api/user/profile').send({ name: 'Hacker' });
  assert.equal(putRes.status, 401, 'Profile PUT without token must be 401');

  const passRes = await request().put('/api/user/password').send({ currentPassword: 'foo', newPassword: 'bar' });
  assert.equal(passRes.status, 401, 'Password PUT without token must be 401');

  const addrRes = await request().get('/api/user/addresses');
  assert.equal(addrRes.status, 401, 'Addresses GET without token must be 401');
});

test('Customer Profile: Fetch profile with addresses', async () => {
  const res = await request()
    .get('/api/user/profile')
    .set('Authorization', `Bearer ${tokenA}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.id, CUSTOMER_A.id);
  assert.equal(res.body.user.email, CUSTOMER_A.email);
  assert.equal(res.body.user.name, CUSTOMER_A.name);
  assert.equal(Array.isArray(res.body.user.addresses), true);
  assert.equal(res.body.user.password, undefined);
  assert.equal(res.body.user.password_hash, undefined);
});

test('Customer Profile: Update name and phone with server-side validation', async () => {
  const emptyRes = await request()
    .put('/api/user/profile')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ name: '   ', phone: '123' });
  assert.equal(emptyRes.status, 400);
  assert.equal(emptyRes.body.success, false);

  const validRes = await request()
    .put('/api/user/profile')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ name: 'Alice Wonderland', phone: '9123456789' });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body.success, true);
  assert.equal(validRes.body.user.name, 'Alice Wonderland');
  assert.equal(validRes.body.user.phone, '9123456789');

  // Verify in DB directly
  const [dbUser] = await pool.query('SELECT name, phone FROM users WHERE id = ?', [CUSTOMER_A.id]);
  assert.equal(dbUser[0].name, 'Alice Wonderland');
  assert.equal(dbUser[0].phone, '9123456789');
});

test('Customer Password: Change password enforces current password and policy', async () => {
  // Missing fields
  const missingRes = await request()
    .put('/api/user/password')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ currentPassword: CUSTOMER_A.password });
  assert.equal(missingRes.status, 400);

  // Short password (< 8 chars)
  const shortRes = await request()
    .put('/api/user/password')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ currentPassword: CUSTOMER_A.password, newPassword: 'short' });
  assert.equal(shortRes.status, 400);

  // Incorrect current password
  const wrongRes = await request()
    .put('/api/user/password')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ currentPassword: 'wrong-current-password', newPassword: 'brandNewPassword123!' });
  assert.equal(wrongRes.status, 401);

  // Successful password update
  const successRes = await request()
    .put('/api/user/password')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ currentPassword: CUSTOMER_A.password, newPassword: 'brandNewPassword123!' });
  assert.equal(successRes.status, 200);
  assert.equal(successRes.body.success, true);

  // Old password should now fail login
  const loginOld = await request()
    .post('/api/auth/user/login')
    .send({ email: CUSTOMER_A.email, password: CUSTOMER_A.password });
  assert.equal(loginOld.status, 401);

  // New password succeeds
  const loginNew = await request()
    .post('/api/auth/user/login')
    .send({ email: CUSTOMER_A.email, password: 'brandNewPassword123!' });
  assert.equal(loginNew.status, 200);
  assert.equal(loginNew.body.success, true);
});

test('Customer Address: CRUD, isolation, and default assignment', async () => {
  // 1. Add Address 1 for Customer A (should automatically become default because first address)
  const add1 = await request()
    .post('/api/user/addresses')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      name: 'Alice Home',
      phone: '9876543210',
      street: '123 Forest Lane',
      city: 'Wonderland City',
      state: 'Fantasy',
      postcode: '123456',
      country: 'India'
    });
  assert.equal(add1.status, 201);
  assert.equal(add1.body.success, true);
  const addr1 = add1.body.address;
  assert.equal(addr1.isDefault, true, 'First address must automatically be default');

  // 2. Add Address 2 for Customer A (not default)
  const add2 = await request()
    .post('/api/user/addresses')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      name: 'Alice Office',
      phone: '9876543210',
      street: '456 Tech Park',
      city: 'Wonderland City',
      state: 'Fantasy',
      postcode: '123457',
      isDefault: false
    });
  assert.equal(add2.status, 201);
  const addr2 = add2.body.address;
  assert.equal(addr2.isDefault, false);

  // 3. Customer B attempts to view, update, delete, or default Customer A addresses
  const bList = await request()
    .get('/api/user/addresses')
    .set('Authorization', `Bearer ${tokenB}`);
  assert.equal(bList.status, 200);
  assert.equal(bList.body.addresses.length, 0, 'Customer B must see 0 addresses');

  const bUpdateCross = await request()
    .put(`/api/user/addresses/${addr1.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ name: 'Hacked', street: 'Street', city: 'City', state: 'ST', postcode: '111111' });
  assert.equal(bUpdateCross.status, 404, 'Cross-user update must return 404 (not found in user scope)');

  const bDefaultCross = await request()
    .put(`/api/user/addresses/${addr1.id}/default`)
    .set('Authorization', `Bearer ${tokenB}`);
  assert.equal(bDefaultCross.status, 404, 'Cross-user set default must return 404');

  const bDeleteCross = await request()
    .delete(`/api/user/addresses/${addr1.id}`)
    .set('Authorization', `Bearer ${tokenB}`);
  assert.equal(bDeleteCross.status, 404, 'Cross-user delete must return 404');

  // 4. Set addr2 as default for Customer A (should make addr2 default and addr1 non-default)
  const setDefaultRes = await request()
    .put(`/api/user/addresses/${addr2.id}/default`)
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(setDefaultRes.status, 200);

  const aList = await request()
    .get('/api/user/addresses')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(aList.body.addresses.length, 2);
  const updatedAddr2 = aList.body.addresses.find((a) => a.id === addr2.id);
  const updatedAddr1 = aList.body.addresses.find((a) => a.id === addr1.id);
  assert.equal(updatedAddr2.isDefault, true);
  assert.equal(updatedAddr1.isDefault, false);

  // 5. Delete default address (addr2): remaining address (addr1) should be promoted to default
  const delRes = await request()
    .delete(`/api/user/addresses/${addr2.id}`)
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(delRes.status, 200);

  const aListAfterDel = await request()
    .get('/api/user/addresses')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(aListAfterDel.body.addresses.length, 1);
  assert.equal(aListAfterDel.body.addresses[0].id, addr1.id);
  assert.equal(aListAfterDel.body.addresses[0].isDefault, true, 'Remaining address must be promoted to default when default is deleted');
});
