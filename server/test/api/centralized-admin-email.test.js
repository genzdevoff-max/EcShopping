import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'rameshthooyavan@gmail.com';
process.env.SMTP_EMAIL = 'genzdevoff@gmail.com';
process.env.SMTP_PASSWORD = 'test-smtp-password';
process.env.SENDER_NAME = 'EcShopping';
process.env.SUPPORT_EMAIL = 'support@ecshopping.in';
process.env.ADMIN_NOTIFICATION_EMAIL = 'rameshthooyavan@gmail.com';
process.env.FRONTEND_URL = 'https://ecshopping.in';

const {
  transporter,
  getAdminSender,
  getAdminNotificationRecipient,
  getSupportReplyTo,
  getFrontendUrl,
  sendAdminEmail,
  sendCustomerWelcomeEmail,
  sendVendorWelcomeEmail,
  sendCustomerVerificationEmail,
  sendVendorVerificationEmail,
  sendResendVerificationEmail,
  sendPasswordResetEmail,
  sendVendorProductSubmissionNotification,
  sendProductApprovalStatusEmail,
  sendOrderConfirmationEmail,
  sendPaymentStatusEmail,
  sendOrderFulfillmentStatusEmail,
  sendOrderCancellationEmail,
  sendVendorAccountStatusEmail
} = await import('../../services/emailService.js');

let lastSentMail = null;

// Mock transporter.sendMail before running tests
transporter.sendMail = async (options) => {
  lastSentMail = options;
  return { messageId: 'mock-msg-' + Date.now(), response: '250 OK' };
};

beforeEach(() => {
  lastSentMail = null;
});

// Helper invariant checker
const assertAdminSenderInvariant = ({ expectedTo, expectedReplyTo, forbiddenFromSubstrings = [] }) => {
  assert.ok(lastSentMail, 'An email must have been dispatched');
  const adminSender = getAdminSender();

  // 1. Mandatory Invariant: From must strictly be the configured Admin sender
  assert.equal(lastSentMail.from, adminSender.from, `From header must strictly match official Admin sender: "${adminSender.from}"`);
  assert.ok(lastSentMail.from.includes(adminSender.email), `From header must include official admin email ${adminSender.email}`);
  assert.ok(lastSentMail.from.includes('EcShopping'), 'From header display name must include EcShopping branding');

  // 2. Mandatory Invariant: No customer or vendor address may EVER be in From header
  for (const forbidden of forbiddenFromSubstrings) {
    if (forbidden) {
      assert.ok(
        !lastSentMail.from.toLowerCase().includes(forbidden.toLowerCase()),
        `Forbidden email "${forbidden}" leaked into From header: "${lastSentMail.from}"`
      );
    }
  }

  // 3. Recipient check
  if (expectedTo) {
    assert.equal(lastSentMail.to.toLowerCase(), expectedTo.toLowerCase(), `Recipient must match ${expectedTo}`);
  }

  // 4. Reply-To check
  if (expectedReplyTo) {
    assert.equal(lastSentMail.replyTo.toLowerCase(), expectedReplyTo.toLowerCase(), `Reply-To must match ${expectedReplyTo}`);
  }
};

test('Category 1: Customer registration & welcome email', async () => {
  const customerEmail = 'alice.customer@example.com';
  const customerName = 'Alice Green';
  const rawToken = 'test-token-cust-123';

  await sendCustomerWelcomeEmail({ email: customerEmail, name: customerName, rawToken });

  assertAdminSenderInvariant({
    expectedTo: customerEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [customerEmail]
  });

  assert.match(lastSentMail.subject, /Welcome to EcShopping/i);
  assert.ok(lastSentMail.html.includes(customerName));
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/verify-email?token=test-token-cust-123&role=customer'));
});

test('Category 2: Vendor registration & welcome email', async () => {
  const vendorEmail = 'bob.artisan@example.com';
  const vendorName = 'Bob Artisan Crafts';
  const rawToken = 'test-token-vend-456';

  await sendVendorWelcomeEmail({ email: vendorEmail, name: vendorName, rawToken });

  assertAdminSenderInvariant({
    expectedTo: vendorEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendorEmail]
  });

  assert.match(lastSentMail.subject, /Welcome to EcShopping Seller Portal/i);
  assert.ok(lastSentMail.html.includes(vendorName));
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/verify-email?token=test-token-vend-456&role=vendor'));
});

test('Category 3: Customer email verification email', async () => {
  const customerEmail = 'carol.cust@example.com';
  const customerName = 'Carol Cust';
  const rawToken = 'verify-tok-cust-789';

  await sendCustomerVerificationEmail({ email: customerEmail, name: customerName, rawToken, isResend: false });

  assertAdminSenderInvariant({
    expectedTo: customerEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [customerEmail]
  });

  assert.match(lastSentMail.subject, /Verify your email/i);
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/verify-email?token=verify-tok-cust-789&role=customer'));
});

test('Category 4: Vendor email verification email', async () => {
  const vendorEmail = 'dave.vendor@example.com';
  const vendorName = 'Dave Spice Co';
  const rawToken = 'verify-tok-vend-012';

  await sendVendorVerificationEmail({ email: vendorEmail, name: vendorName, rawToken, isResend: false });

  assertAdminSenderInvariant({
    expectedTo: vendorEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendorEmail]
  });

  assert.match(lastSentMail.subject, /Verify your email/i);
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/verify-email?token=verify-tok-vend-012&role=vendor'));
});

test('Category 5: Resend verification email (Customer & Vendor)', async () => {
  const custEmail = 'eve.resend@example.com';
  await sendResendVerificationEmail({ email: custEmail, name: 'Eve', role: 'customer', rawToken: 'resend-cust-tok' });

  assertAdminSenderInvariant({
    expectedTo: custEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [custEmail]
  });
  assert.match(lastSentMail.subject, /Verify your email address/i);

  const vendEmail = 'frank.resend@example.com';
  await sendResendVerificationEmail({ email: vendEmail, name: 'Frank', role: 'vendor', rawToken: 'resend-vend-tok' });

  assertAdminSenderInvariant({
    expectedTo: vendEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendEmail]
  });
  assert.match(lastSentMail.subject, /Verify your seller email address/i);
});

test('Category 6: Customer forgot-password & reset email', async () => {
  const custEmail = 'grace.buyer@example.com';
  const custName = 'Grace Buyer';
  const rawToken = 'pw-reset-cust-tok-999';

  await sendPasswordResetEmail({ email: custEmail, name: custName, role: 'customer', rawToken });

  assertAdminSenderInvariant({
    expectedTo: custEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [custEmail]
  });

  assert.match(lastSentMail.subject, /Reset your EcShopping password/i);
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/reset-password?token=pw-reset-cust-tok-999&role=customer'));
});

test('Category 7: Vendor forgot-password & reset email', async () => {
  const vendEmail = 'helen.seller@example.com';
  const vendName = 'Helen Handmade';
  const rawToken = 'pw-reset-vend-tok-888';

  await sendPasswordResetEmail({ email: vendEmail, name: vendName, role: 'vendor', rawToken });

  assertAdminSenderInvariant({
    expectedTo: vendEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendEmail]
  });

  assert.match(lastSentMail.subject, /Reset your EcShopping password/i);
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/reset-password?token=pw-reset-vend-tok-888&role=vendor'));
  assert.ok(lastSentMail.html.includes('Seller'));
});

test('Category 8: Admin password-related emails', async () => {
  const adminEmail = 'admin.backup@ecshopping.in';
  const rawToken = 'pw-reset-admin-tok-777';

  await sendPasswordResetEmail({ email: adminEmail, name: 'Lead Admin', role: 'admin', rawToken });

  assertAdminSenderInvariant({
    expectedTo: adminEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: []
  });

  assert.match(lastSentMail.subject, /Reset your EcShopping password/i);
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/reset-password?token=pw-reset-admin-tok-777&role=admin'));
  assert.ok(lastSentMail.html.includes('Administrator'));
});

test('Category 9: Vendor new-product submission notification (Sent to Admin)', async () => {
  const vendorEmail = 'artisan.potter@example.com';
  const vendorName = 'Clay Studio';
  const adminNotifRecipient = getAdminNotificationRecipient();

  await sendVendorProductSubmissionNotification({
    vendorName,
    vendorEmail,
    productTitle: 'Handcrafted Terracotta Planter',
    productId: 'p_terracotta_101',
    category: 'Home & Living',
    price: 850
  });

  // Strict check: FROM is Admin, TO is Admin Notification recipient, REPLY-TO is Vendor
  assertAdminSenderInvariant({
    expectedTo: adminNotifRecipient,
    expectedReplyTo: vendorEmail,
    forbiddenFromSubstrings: [vendorEmail] // Vendor email must NOT be the sender
  });

  assert.match(lastSentMail.subject, /\[Product Approval Needed\]/i);
  assert.match(lastSentMail.subject, /Handcrafted Terracotta Planter/);
  assert.ok(lastSentMail.html.includes('Clay Studio'));
  assert.ok(lastSentMail.html.includes('p_terracotta_101'));
  assert.ok(lastSentMail.html.includes('₹850'));
});

test('Category 10: Admin product approval and rejection notifications', async () => {
  const vendorEmail = 'silk.weaves@example.com';
  const vendorName = 'Silk Weaves Studio';

  // Approved
  await sendProductApprovalStatusEmail({
    vendorEmail,
    vendorName,
    productTitle: 'Pure Kanchipuram Silk Saree',
    productId: 'p_silk_202',
    status: 'approved'
  });

  assertAdminSenderInvariant({
    expectedTo: vendorEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendorEmail]
  });

  assert.match(lastSentMail.subject, /Your product has been approved/i);
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/product/p_silk_202'));

  // Rejected
  await sendProductApprovalStatusEmail({
    vendorEmail,
    vendorName,
    productTitle: 'Pure Kanchipuram Silk Saree',
    productId: 'p_silk_202',
    status: 'rejected',
    reason: 'Please upload higher resolution images and specify fabric certification.'
  });

  assertAdminSenderInvariant({
    expectedTo: vendorEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendorEmail]
  });

  assert.match(lastSentMail.subject, /Product listing update/i);
  assert.ok(lastSentMail.html.includes('higher resolution images'));
});

test('Category 11: Customer order confirmation emails', async () => {
  const customerEmail = 'priya.sharma@example.com';
  const customerName = 'Priya Sharma';

  const dummyOrder = {
    id: 'ord_1001',
    customerEmail,
    customerName,
    subtotal: 1200,
    discount: 100,
    shipping: 50,
    total: 1150,
    shippingAddress: '42 MG Road, Bengaluru, Karnataka 560001'
  };

  const dummyItems = [
    { title: 'Organic Darjeeling Tea', quantity: 2, unitPrice: 600, vendorName: 'Tea Estate Co' }
  ];

  await sendOrderConfirmationEmail({
    order: dummyOrder,
    items: dummyItems,
    customerEmail,
    customerName
  });

  assertAdminSenderInvariant({
    expectedTo: customerEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [customerEmail]
  });

  assert.match(lastSentMail.subject, /Order Confirmation #ord_1001/i);
  assert.ok(lastSentMail.html.includes('Organic Darjeeling Tea'));
  assert.ok(lastSentMail.html.includes('₹1150'));
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/track-order?orderId=ord_1001'));
});

test('Category 12: Payment confirmation and payment status emails', async () => {
  const customerEmail = 'rahul.verma@example.com';
  const customerName = 'Rahul Verma';

  const dummyOrder = {
    id: 'ord_1002',
    customerEmail,
    customerName,
    total: 2499
  };

  await sendPaymentStatusEmail({
    order: dummyOrder,
    paymentStatus: 'paid',
    paymentMethod: 'PhonePe UPI',
    transactionReference: 'TXN-PHONEPE-998877',
    customerEmail,
    customerName
  });

  assertAdminSenderInvariant({
    expectedTo: customerEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [customerEmail]
  });

  assert.match(lastSentMail.subject, /Payment Received for Order #ord_1002/i);
  assert.ok(lastSentMail.html.includes('TXN-PHONEPE-998877'));
  assert.ok(lastSentMail.html.includes('₹2499'));
});

test('Category 13: Order shipment and delivery notifications', async () => {
  const customerEmail = 'anita.deshmukh@example.com';
  const customerName = 'Anita Deshmukh';

  const dummyOrder = {
    id: 'ord_1003',
    customerEmail,
    customerName,
    total: 899
  };

  // Shipped
  await sendOrderFulfillmentStatusEmail({
    order: dummyOrder,
    newStatus: 'Shipped',
    customerEmail,
    customerName
  });

  assertAdminSenderInvariant({
    expectedTo: customerEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [customerEmail]
  });

  assert.match(lastSentMail.subject, /Your Order #ord_1003 has been Shipped/i);
  assert.ok(lastSentMail.html.includes('https://ecshopping.in/track-order?orderId=ord_1003'));

  // Delivered
  await sendOrderFulfillmentStatusEmail({
    order: dummyOrder,
    newStatus: 'Delivered',
    customerEmail,
    customerName
  });

  assertAdminSenderInvariant({
    expectedTo: customerEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [customerEmail]
  });

  assert.match(lastSentMail.subject, /Your Order #ord_1003 has been Delivered/i);
});

test('Category 14: Refund and cancellation notifications', async () => {
  const customerEmail = 'vikram.singh@example.com';
  const customerName = 'Vikram Singh';

  const dummyOrder = {
    id: 'ord_1004',
    customerEmail,
    customerName,
    total: 1750
  };

  await sendOrderCancellationEmail({
    order: dummyOrder,
    customerEmail,
    customerName,
    reason: 'Customer requested order cancellation before dispatch'
  });

  assertAdminSenderInvariant({
    expectedTo: customerEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [customerEmail]
  });

  assert.match(lastSentMail.subject, /Order Cancellation Confirmation #ord_1004/i);
  assert.ok(lastSentMail.html.includes('Customer requested order cancellation before dispatch'));
  assert.ok(lastSentMail.html.includes('₹1750'));
});

test('Category 15: Vendor account status notifications (Approved, Rejected, Deactivated)', async () => {
  const vendorEmail = 'kavita.textiles@example.com';
  const vendorName = 'Kavita Textiles';

  // Approved
  await sendVendorAccountStatusEmail({
    email: vendorEmail,
    name: vendorName,
    status: 'approved'
  });

  assertAdminSenderInvariant({
    expectedTo: vendorEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendorEmail]
  });

  assert.match(lastSentMail.subject, /Your seller account has been approved/i);
  assert.ok(lastSentMail.html.includes('Access Seller Portal'));

  // Rejected
  await sendVendorAccountStatusEmail({
    email: vendorEmail,
    name: vendorName,
    status: 'rejected'
  });

  assertAdminSenderInvariant({
    expectedTo: vendorEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendorEmail]
  });

  assert.match(lastSentMail.subject, /Your seller application update/i);

  // Deactivated
  await sendVendorAccountStatusEmail({
    email: vendorEmail,
    name: vendorName,
    status: 'deactivated'
  });

  assertAdminSenderInvariant({
    expectedTo: vendorEmail,
    expectedReplyTo: getSupportReplyTo(),
    forbiddenFromSubstrings: [vendorEmail]
  });

  assert.match(lastSentMail.subject, /Your seller account status update/i);
  assert.ok(lastSentMail.html.includes('deactivated by the administrator'));
});
