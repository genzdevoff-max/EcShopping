import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

const { default: app } = await import('../../index.js');
const { pool } = await import('../../db.js');
const { signToken } = await import('../../middleware/auth.js');
const { hashPassword } = await import('../../utils/passwords.js');

const request = () => supertest(app);

const RUN_ID = Date.now();
const TEST_ADMIN_ID = `adm-wf-${RUN_ID}`;
const TEST_ADMIN_EMAIL = `admin-wf-${RUN_ID}@ecshopping.test`;
const TEST_ADMIN_TOKEN = signToken({
  sub: TEST_ADMIN_ID,
  id: TEST_ADMIN_ID,
  role: 'admin',
  email: TEST_ADMIN_EMAIL,
  name: 'Admin Reviewer'
});

const TEST_VENDOR = {
  businessName: `Green Valley Organics ${RUN_ID}`,
  ownerName: 'Venkatesh Raman',
  registeredName: `Green Valley Organics Pvt Ltd ${RUN_ID}`,
  businessType: 'Private Limited Company',
  email: `greenvalley-${RUN_ID}@farmmail.in`,
  phone: '9876543210',
  password: 'SecureFarmPassword2026!',
  address: '45 Organic Farm Road, Pollachi Taluk',
  city: 'Coimbatore',
  district: 'Coimbatore',
  state: 'Tamil Nadu',
  pincode: '642001',
  country: 'India',
  bio: 'Certified organic spice and coconut farmers with direct farm-to-customer harvest.',
  gstStatus: 'registered',
  gstin: '33AAAAA0000A1Z5',
  fssaiStatus: 'registered',
  fssaiNumber: '12423001000543',
  bankAccountHolder: 'Green Valley Organics Pvt Ltd',
  bankName: 'State Bank of India',
  bankAccountNumber: '987654321098',
  bankIfsc: 'SBIN0001234'
};

let createdVendorId = null;
let vendorAuthToken = null;
let testVideoIdApproved = null;
let testVideoIdRejected = null;

before(async () => {
  // Ensure test admin exists in admins table for foreign key / audit consistency
  await pool.query(
    'INSERT INTO admins (id, email, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE email = ?',
    [TEST_ADMIN_ID, TEST_ADMIN_EMAIL, await hashPassword('AdminPass2026!'), TEST_ADMIN_EMAIL]
  );
});

after(async () => {
  // Clean up any test records created during the workflow test
  if (testVideoIdApproved) {
    await pool.query('DELETE FROM product_videos WHERE id = ?', [testVideoIdApproved]).catch(() => {});
  }
  if (testVideoIdRejected) {
    await pool.query('DELETE FROM product_videos WHERE id = ?', [testVideoIdRejected]).catch(() => {});
  }
  if (createdVendorId) {
    await pool.query('DELETE FROM email_verifications WHERE LOWER(email) = LOWER(?)', [TEST_VENDOR.email]).catch(() => {});
    await pool.query('DELETE FROM password_resets WHERE LOWER(email) = LOWER(?)', [TEST_VENDOR.email]).catch(() => {});
    await pool.query('DELETE FROM vendors WHERE id = ?', [createdVendorId]).catch(() => {});
  }
  await pool.query('DELETE FROM admins WHERE id = ?', [TEST_ADMIN_ID]).catch(() => {});
  await pool.end();
});

test('1. Vendor Registration: Submits complete personal, business, regulatory, and banking details', async () => {
  const res = await request()
    .post('/api/auth/vendor/register')
    .send({
      name: TEST_VENDOR.businessName,
      email: TEST_VENDOR.email,
      password: TEST_VENDOR.password,
      phone: TEST_VENDOR.phone,
      businessName: TEST_VENDOR.businessName,
      businessType: TEST_VENDOR.businessType,
      ownerName: TEST_VENDOR.ownerName,
      registeredName: TEST_VENDOR.registeredName,
      address: TEST_VENDOR.address,
      city: TEST_VENDOR.city,
      district: TEST_VENDOR.district,
      state: TEST_VENDOR.state,
      pincode: TEST_VENDOR.pincode,
      country: TEST_VENDOR.country,
      bio: TEST_VENDOR.bio,
      gstStatus: TEST_VENDOR.gstStatus,
      gstin: TEST_VENDOR.gstin,
      fssaiStatus: TEST_VENDOR.fssaiStatus,
      fssaiNumber: TEST_VENDOR.fssaiNumber,
      bankAccountHolder: TEST_VENDOR.bankAccountHolder,
      bankName: TEST_VENDOR.bankName,
      bankAccountNumber: TEST_VENDOR.bankAccountNumber,
      bankIfsc: TEST_VENDOR.bankIfsc
    });

  assert.equal(res.status, 201, `Expected 201 Created but got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.success, true);
  assert.ok(res.body.vendor);
  assert.equal(res.body.vendor.email, TEST_VENDOR.email.toLowerCase());
  assert.equal(res.body.vendor.status, 'pending');

  createdVendorId = res.body.vendor.id;

  // Verify full persistence in the database
  const [rows] = await pool.query('SELECT * FROM vendors WHERE id = ?', [createdVendorId]);
  assert.equal(rows.length, 1);
  const v = rows[0];
  assert.equal(v.status, 'pending');
  assert.equal(v.owner_name, TEST_VENDOR.ownerName);
  assert.equal(v.business_name, TEST_VENDOR.businessName);
  assert.equal(v.registered_name, TEST_VENDOR.registeredName);
  assert.equal(v.business_type, TEST_VENDOR.businessType);
  assert.equal(v.address, TEST_VENDOR.address);
  assert.equal(v.city, TEST_VENDOR.city);
  assert.equal(v.district, TEST_VENDOR.district);
  assert.equal(v.state, TEST_VENDOR.state);
  assert.equal(v.pincode, TEST_VENDOR.pincode);
  assert.equal(v.gst_status, TEST_VENDOR.gstStatus);
  assert.equal(v.gstin, TEST_VENDOR.gstin);
  assert.equal(v.fssai_status, TEST_VENDOR.fssaiStatus);
  assert.equal(v.fssai_number, TEST_VENDOR.fssaiNumber);
  assert.equal(v.bank_account_holder, TEST_VENDOR.bankAccountHolder);
  assert.equal(v.bank_name, TEST_VENDOR.bankName);
  assert.equal(v.bank_account_number, TEST_VENDOR.bankAccountNumber);
  assert.equal(v.bank_ifsc, TEST_VENDOR.bankIfsc);
});

test('2. Vendor Login before Admin Approval: Rejected with 403 Forbidden and pending message', async () => {
  const res = await request()
    .post('/api/auth/vendor/login')
    .send({
      email: TEST_VENDOR.email,
      password: TEST_VENDOR.password
    });

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.status, 'pending');
  assert.match(res.body.error, /pending admin approval/i);
});

test('3. Admin Review & Approval: Admin reviews vendor details and approves vendor account', async () => {
  const res = await request()
    .put(`/api/vendors/${createdVendorId}/verification`)
    .set('Authorization', `Bearer ${TEST_ADMIN_TOKEN}`)
    .send({
      status: 'approved',
      notes: 'All compliance, GSTIN, FSSAI, and bank verification documents verified successfully.'
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.status, 'approved');

  // Verify status in DB
  const [rows] = await pool.query('SELECT status, reviewed_by FROM vendors WHERE id = ?', [createdVendorId]);
  assert.equal(rows[0].status, 'approved');
});

test('4. Vendor Login after Admin Approval: Successful authentication and token issuance', async () => {
  const res = await request()
    .post('/api/auth/vendor/login')
    .send({
      email: TEST_VENDOR.email,
      password: TEST_VENDOR.password
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);
  assert.ok(res.body.vendor);
  assert.equal(res.body.vendor.id, createdVendorId);
  assert.equal(res.body.vendor.status, 'approved');

  vendorAuthToken = res.body.token;
});

test('5. Vendor Video Upload: Submits video for review -> Saved with status "pending"', async () => {
  const res = await request()
    .post('/api/vendor/videos')
    .set('Authorization', `Bearer ${vendorAuthToken}`)
    .send({
      title: 'Pollachi Organic Coconut Farm Tour',
      description: 'Behind the scenes at Green Valley Organics harvest.',
      videoUrl: 'https://res.cloudinary.com/test-cloud/video/upload/v1234/ecshopping/products/videos/farm-tour.mp4',
      format: 'mp4',
      duration: 38.4,
      bytes: 8450000
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.video);
  assert.equal(res.body.video.status, 'pending');
  assert.equal(res.body.video.vendorId, createdVendorId);
  assert.equal(res.body.video.title, 'Pollachi Organic Coconut Farm Tour');

  testVideoIdApproved = res.body.video.id;

  // Vendor lists their own videos -> sees status 'pending'
  const vendorListRes = await request()
    .get('/api/vendor/videos')
    .set('Authorization', `Bearer ${vendorAuthToken}`);

  assert.equal(vendorListRes.status, 200);
  assert.equal(vendorListRes.body.success, true);
  const foundInVendorList = vendorListRes.body.videos.find((v) => v.id === testVideoIdApproved);
  assert.ok(foundInVendorList);
  assert.equal(foundInVendorList.status, 'pending');
});

test('6. Homepage Isolation: Pending video must NOT appear on public customer homepage', async () => {
  const res = await request().get('/api/videos/public');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const foundInPublic = res.body.videos.find((v) => v.id === testVideoIdApproved);
  assert.equal(foundInPublic, undefined, 'Pending video MUST NOT appear on customer homepage video section');
});

test('7. Admin Review: Admin sees pending video in review dashboard', async () => {
  const res = await request()
    .get('/api/videos')
    .set('Authorization', `Bearer ${TEST_ADMIN_TOKEN}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const pendingVideo = res.body.videos.find((v) => v.id === testVideoIdApproved);
  assert.ok(pendingVideo, 'Pending video must be visible to Admin');
  assert.equal(pendingVideo.status, 'pending');
  assert.equal(pendingVideo.vendorId, createdVendorId);
});

test('8. Admin Video Approval: Admin approves video -> Status changes to "approved"', async () => {
  const res = await request()
    .put(`/api/videos/${testVideoIdApproved}/status`)
    .set('Authorization', `Bearer ${TEST_ADMIN_TOKEN}`)
    .send({
      status: 'approved'
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // Check DB status
  const [rows] = await pool.query('SELECT status FROM product_videos WHERE id = ?', [testVideoIdApproved]);
  assert.equal(rows[0].status, 'approved');
});

test('9. Homepage Display: Approved video AUTOMATICALLY displays on customer homepage video rail', async () => {
  const res = await request().get('/api/videos/public');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const foundInPublic = res.body.videos.find((v) => v.id === testVideoIdApproved);
  assert.ok(foundInPublic, 'Approved video MUST appear in customer homepage video section');
  assert.equal(foundInPublic.title, 'Pollachi Organic Coconut Farm Tour');
  assert.equal(foundInPublic.status, 'approved');
});

test('10. Video Rejection: Vendor submits another video -> Admin rejects it -> Not on homepage, reason visible to vendor', async () => {
  // Vendor submits 2nd video
  const submitRes = await request()
    .post('/api/vendor/videos')
    .set('Authorization', `Bearer ${vendorAuthToken}`)
    .send({
      title: 'Low Quality Sample Video',
      videoUrl: 'https://res.cloudinary.com/test-cloud/video/upload/v1234/ecshopping/products/videos/sample-blurry.mp4'
    });

  assert.equal(submitRes.status, 201);
  testVideoIdRejected = submitRes.body.video.id;

  // Admin rejects video with specific reason
  const rejectRes = await request()
    .put(`/api/videos/${testVideoIdRejected}/status`)
    .set('Authorization', `Bearer ${TEST_ADMIN_TOKEN}`)
    .send({
      status: 'rejected',
      reason: 'Video resolution is too low and lacks product branding.'
    });

  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.success, true);

  // Verify rejected video does NOT appear on customer homepage
  const publicRes = await request().get('/api/videos/public');
  const foundRejected = publicRes.body.videos.find((v) => v.id === testVideoIdRejected);
  assert.equal(foundRejected, undefined, 'Rejected video MUST NOT appear on customer homepage');

  // Verify vendor sees status 'rejected' and rejection reason in Vendor Dashboard
  const vendorVideosRes = await request()
    .get('/api/vendor/videos')
    .set('Authorization', `Bearer ${vendorAuthToken}`);

  const vendorRejectedVid = vendorVideosRes.body.videos.find((v) => v.id === testVideoIdRejected);
  assert.ok(vendorRejectedVid);
  assert.equal(vendorRejectedVid.status, 'rejected');
  assert.equal(vendorRejectedVid.rejectionReason, 'Video resolution is too low and lacks product branding.');

  // Vendor deletes the rejected video
  const deleteRes = await request()
    .delete(`/api/vendor/videos/${testVideoIdRejected}`)
    .set('Authorization', `Bearer ${vendorAuthToken}`);

  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.success, true);

  const [dbRows] = await pool.query('SELECT id FROM product_videos WHERE id = ?', [testVideoIdRejected]);
  assert.equal(dbRows.length, 0, 'Deleted video must be removed from DB');
  testVideoIdRejected = null; // Cleared so after() doesn't attempt deletion
});
