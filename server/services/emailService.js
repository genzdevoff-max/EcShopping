/**
 * ============================================================
 * EcShopping Centralized Admin Email Service
 * ============================================================
 * Mandatory Rule: ALL outgoing emails across EcShopping MUST originate
 * from the official EcShopping Admin email account.
 *
 * Sender Identity:
 * - From Email: Authenticated SMTP Admin Account (SMTP_EMAIL / ADMIN_EMAIL)
 * - From Display Name: "EcShopping Admin" (or configured SENDER_NAME)
 * - Reply-To: Official Support / Admin email (or vendor when Admin replies)
 *
 * Recipients are strictly separated from sender configuration.
 * Under NO circumstances may a Customer or Vendor email be used as
 * the From header.
 * ============================================================
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Robustly load server/.env regardless of execution directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const getSmtpConfig = () => {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
  const isSmtpSecure = process.env.SMTP_SECURE !== undefined
    ? String(process.env.SMTP_SECURE).trim().toLowerCase() === 'true'
    : smtpPort === 465;

  return {
    host: smtpHost,
    port: smtpPort,
    secure: isSmtpSecure,
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  };
};

export const transporter = nodemailer.createTransport(getSmtpConfig());

if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
  transporter.verify()
    .then(() => console.log(`✅ [Centralized Email] SMTP connected as ${process.env.SMTP_EMAIL} (${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || 465})`))
    .catch((err) => console.error('❌ [Centralized Email] SMTP connection failed:', err.message));
} else {
  console.warn('⚠️ [Centralized Email] SMTP not configured (SMTP_EMAIL / SMTP_PASSWORD) — emails will be simulated or skipped.');
}

/**
 * Escapes HTML characters for safe rendering in email templates.
 */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

/**
 * Resolves the official Admin sender configuration.
 * Always resolves to the official configured Admin account.
 */
export const getAdminSender = () => {
  const adminEmail = process.env.SMTP_EMAIL || process.env.ADMIN_EMAIL || 'econnectshopping@gmail.com';
  const brandName = process.env.SENDER_NAME || 'EcShopping';
  const displayName = brandName.toLowerCase().includes('admin')
    ? brandName
    : `${brandName} Admin`;

  const fromAddress = process.env.SMTP_FROM || `"${displayName}" <${adminEmail}>`;

  return {
    email: adminEmail,
    displayName,
    from: fromAddress
  };
};

/**
 * Resolves the Admin recipient for administrative notifications (e.g. new vendor product submission).
 */
export const getAdminNotificationRecipient = () => {
  return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL || 'econnectshopping@gmail.com';
};

/**
 * Resolves the official customer support reply-to email.
 */
export const getSupportReplyTo = () => {
  return process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_EMAIL || 'econnectshopping@gmail.com';
};

/**
 * Resolves the canonical frontend storefront origin for link generation.
 * Production canonical is always https://ecshopping.in unless explicitly overridden.
 */
export const getFrontendUrl = () => {
  const custom = String(process.env.FRONTEND_URL || '').trim();
  if (custom) {
    return custom.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5173';
  }
  return 'https://ecshopping.in';
};

/**
 * Standard branded HTML email template wrapper.
 */
const renderEmailLayout = ({ headline = '', contentHtml = '', footerNote = '' }) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; color: #1f2937; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0e5c4a; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${escapeHtml(brand)}</h1>
        ${headline ? `<p style="color: #6b7280; font-size: 14px; margin-top: 4px;">${escapeHtml(headline)}</p>` : ''}
      </div>
      <div style="font-size: 15px; line-height: 1.6; color: #374151;">
        ${contentHtml}
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center; line-height: 1.5;">
        ${footerNote || `This is an official automated notification from ${escapeHtml(brand)}. Please do not reply directly to this email unless directed.`}
      </p>
    </div>
  `;
};

/**
 * Central low-level email sender.
 * Enforces the Admin sender identity invariant across every outgoing message.
 * Returns structured result with success status, messageId, and detailed diagnostic error information.
 */
export const sendAdminEmail = async ({ to, subject, html, text, replyTo, category = 'General' }) => {
  if (!to) {
    console.warn(`⚠️ [Email: ${category}] Skipped: No recipient specified.`);
    return { success: false, error: 'No recipient specified' };
  }

  const adminSender = getAdminSender();
  const defaultReplyTo = replyTo || getSupportReplyTo();

  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.warn(`⚠️ [SMTP Notice] Email (${category}) to ${to} skipped: SMTP credentials not configured in environment.`);
    return { success: false, skipped: true, error: 'SMTP credentials not configured in environment' };
  }

  // Ensure transporter has active credentials from current process.env
  if (transporter && transporter.options) {
    if (!transporter.options.auth?.user && process.env.SMTP_EMAIL) {
      transporter.options.auth = {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      };
    }
  }

  try {
    const result = await transporter.sendMail({
      from: adminSender.from,
      to,
      replyTo: defaultReplyTo,
      subject,
      text,
      html
    });

    console.log(`📧 [Email: ${category}] Dispatched to ${to} | MsgId: ${result.messageId || 'N/A'} | Response: ${result.response || 'OK'} | Sender: ${adminSender.email}`);
    return {
      success: true,
      messageId: result.messageId,
      response: result.response,
      accepted: result.accepted,
      rejected: result.rejected
    };
  } catch (err) {
    console.error(`❌ [Email: ${category}] Delivery failed to ${to} | Code: ${err.code || 'UNKNOWN'} | ResponseCode: ${err.responseCode || 'N/A'} | Error: ${err.message}`);
    return {
      success: false,
      error: err.message,
      code: err.code,
      responseCode: err.responseCode,
      response: err.response
    };
  }
};

// ============================================================
// 15 Standardized Email Categories
// ============================================================

/**
 * 1. Customer Registration & Welcome Email
 */
export const sendCustomerWelcomeEmail = async ({ email, name, rawToken }) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();
  const verifyLink = `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}&role=customer`;

  const html = renderEmailLayout({
    headline: 'Welcome to EcShopping',
    contentHtml: `
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p>Thank you for creating an account with ${escapeHtml(brand)}! We are thrilled to welcome you to our curated marketplace.</p>
      <p>To ensure account security and activate your member profile, please verify your email address:</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verifyLink}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 15px; border-radius: 6px;">
          Verify Email Address
        </a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">If the button doesn't work, copy this link into your browser:<br/><a href="${verifyLink}" style="color: #0e5c4a; word-break: break-all;">${verifyLink}</a></p>
    `,
    footerNote: `This link expires in 24 hours. Welcome to ${escapeHtml(brand)}!`
  });

  return sendAdminEmail({
    to: email,
    subject: `Welcome to ${brand} — Verify your email`,
    text: `Hello ${name},\n\nWelcome to ${brand}! Please verify your email: ${verifyLink}\n\nThank you,\n${brand} Team`,
    html,
    category: 'Customer Welcome'
  });
};

/**
 * 2. Vendor Registration & Welcome Email
 */
export const sendVendorWelcomeEmail = async ({ email, name, rawToken }) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();
  const verifyLink = `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}&role=vendor`;

  const html = renderEmailLayout({
    headline: 'Seller Application Received',
    contentHtml: `
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p>Thank you for registering as a seller on ${escapeHtml(brand)}! Your seller application has been received and submitted for administrative approval.</p>
      <p>Please verify your email address to complete your seller profile verification:</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verifyLink}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 15px; border-radius: 6px;">
          Verify Seller Email
        </a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">Our administration team reviews seller registrations promptly. You will receive an email notification once your seller account is approved.</p>
    `,
    footerNote: `This link expires in 24 hours. Seller Application — ${escapeHtml(brand)}`
  });

  return sendAdminEmail({
    to: email,
    subject: `Welcome to ${brand} Seller Portal — Verify your email`,
    text: `Hello ${name},\n\nThank you for registering your seller account on ${brand}. Please verify your email: ${verifyLink}\n\nOur admin team is reviewing your application.\n\n${brand} Team`,
    html,
    category: 'Vendor Welcome'
  });
};

/**
 * 3. Customer Email Verification
 */
export const sendCustomerVerificationEmail = async ({ email, name, rawToken, isResend = false }) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();
  const verifyLink = `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}&role=customer`;

  const html = renderEmailLayout({
    headline: 'Email Verification',
    contentHtml: `
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p>${isResend ? 'Here is your new email verification link.' : 'Please verify your email address to ensure your account security.'}</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verifyLink}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 15px; border-radius: 6px;">
          Verify Email Address
        </a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">Link: <a href="${verifyLink}" style="color: #0e5c4a; word-break: break-all;">${verifyLink}</a></p>
    `,
    footerNote: 'This verification link expires in 24 hours.'
  });

  return sendAdminEmail({
    to: email,
    subject: isResend ? `Verify your email address — ${brand}` : `Welcome to ${brand} — Verify your email`,
    text: `Hello ${name},\n\nPlease verify your email address: ${verifyLink}\n\nExpires in 24 hours.\n\n${brand} Team`,
    html,
    category: 'Customer Verification'
  });
};

/**
 * 4. Vendor Email Verification
 */
export const sendVendorVerificationEmail = async ({ email, name, rawToken, isResend = false }) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();
  const verifyLink = `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}&role=vendor`;

  const html = renderEmailLayout({
    headline: 'Seller Email Verification',
    contentHtml: `
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p>${isResend ? 'Here is your new seller email verification link.' : 'Please verify your seller account email address.'}</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verifyLink}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 15px; border-radius: 6px;">
          Verify Seller Email
        </a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">Link: <a href="${verifyLink}" style="color: #0e5c4a; word-break: break-all;">${verifyLink}</a></p>
    `,
    footerNote: 'This verification link expires in 24 hours.'
  });

  return sendAdminEmail({
    to: email,
    subject: isResend ? `Verify your seller email address — ${brand}` : `Welcome to ${brand} Seller Portal — Verify your email`,
    text: `Hello ${name},\n\nPlease verify your seller email address: ${verifyLink}\n\nExpires in 24 hours.\n\n${brand} Team`,
    html,
    category: 'Vendor Verification'
  });
};

/**
 * 5. Resend Verification Email (Universal)
 */
export const sendResendVerificationEmail = async ({ email, name, role = 'customer', rawToken }) => {
  if (role === 'vendor') {
    return sendVendorVerificationEmail({ email, name, rawToken, isResend: true });
  }
  return sendCustomerVerificationEmail({ email, name, rawToken, isResend: true });
};

/**
 * 6, 7, 8. Password Reset Email (Customer, Vendor, Admin)
 */
export const sendPasswordResetEmail = async ({ email, name, role = 'customer', rawToken }) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}&role=${encodeURIComponent(role)}`;

  const roleLabel = role === 'admin' ? 'Administrator' : role === 'vendor' ? 'Seller' : 'Customer';

  const html = renderEmailLayout({
    headline: 'Password Reset Request',
    contentHtml: `
      <p>Hello <strong>${escapeHtml(name || roleLabel)}</strong>,</p>
      <p>We received a request to reset the password for your ${escapeHtml(brand)} <strong>${escapeHtml(roleLabel)}</strong> account.</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 15px; border-radius: 6px;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">If you did not request a password reset, you can safely ignore this email. Your account remains completely secure.</p>
      <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">Direct link: <a href="${resetLink}" style="color: #0e5c4a;">${resetLink}</a></p>
    `,
    footerNote: 'This link expires in 60 minutes for security purposes.'
  });

  return sendAdminEmail({
    to: email,
    subject: `Reset your ${brand} password`,
    text: `Hello ${name || roleLabel},\n\nA password reset was requested for your ${brand} ${roleLabel} account.\n\nReset your password here: ${resetLink}\n\nThis link expires in 60 minutes.\n\n${brand} Team`,
    html,
    category: `${roleLabel} Password Reset`
  });
};

/**
 * 9. Vendor New Product Submission Notification (Sent to Admin)
 * Mandatory: From is Admin; To is Admin Notification Recipient; Reply-To is Vendor.
 */
export const sendVendorProductSubmissionNotification = async ({
  vendorName,
  vendorEmail,
  productTitle,
  productId,
  category,
  price
}) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const adminRecipient = getAdminNotificationRecipient();
  const frontendUrl = getFrontendUrl();
  const reviewUrl = `${frontendUrl}/admin?tab=products`;
  const submissionDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  const html = renderEmailLayout({
    headline: 'New Product Submission Awaiting Review',
    contentHtml: `
      <p>A seller has submitted a new product listing that requires review before appearing on the live storefront.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px;">
        <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; width: 140px;">Product Title:</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${escapeHtml(productTitle)}</td></tr>
        <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Product ID:</td><td style="padding: 8px 0; font-family: monospace; color: #4b5563;">${escapeHtml(productId)}</td></tr>
        <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Seller Name:</td><td style="padding: 8px 0; font-weight: 600; color: #111827;">${escapeHtml(vendorName || 'Seller')}</td></tr>
        <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Seller Email:</td><td style="padding: 8px 0; color: #111827;">${vendorEmail ? escapeHtml(vendorEmail) : 'N/A'}</td></tr>
        <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Category:</td><td style="padding: 8px 0; color: #111827;">${escapeHtml(category)}</td></tr>
        <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Price:</td><td style="padding: 8px 0; font-weight: 700; color: #0e5c4a;">₹${escapeHtml(price)}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Submitted At:</td><td style="padding: 8px 0; color: #4b5563;">${escapeHtml(submissionDate)} IST</td></tr>
      </table>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${reviewUrl}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 6px;">
          Review in Admin Dashboard &rarr;
        </a>
      </div>
    `,
    footerNote: 'EcShopping Operational Administration Notification'
  });

  return sendAdminEmail({
    to: adminRecipient,
    replyTo: vendorEmail || undefined,
    subject: `[Product Approval Needed] ${productTitle} — Submitted by ${vendorName || 'Seller'}`,
    text: `New product awaiting approval:\nProduct: ${productTitle}\nID: ${productId}\nVendor: ${vendorName} (${vendorEmail})\nPrice: ₹${price}\n\nReview link: ${reviewUrl}`,
    html,
    category: 'Admin Product Submission Notification'
  });
};

/**
 * 10. Admin Product Approval / Rejection Notification (Sent to Vendor)
 */
export const sendProductApprovalStatusEmail = async ({
  vendorEmail,
  vendorName,
  productTitle,
  productId,
  status,
  reason = ''
}) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();

  const isApproved = status === 'approved';
  const subject = isApproved
    ? `Your product has been approved — "${productTitle}"`
    : `Product listing update — "${productTitle}"`;

  const headline = isApproved ? 'Product Approved & Live!' : 'Product Listing Update';
  const ctaUrl = isApproved ? `${frontendUrl}/product/${encodeURIComponent(productId)}` : `${frontendUrl}/login`;
  const ctaText = isApproved ? 'View Product on Storefront' : 'Review in Seller Dashboard';

  const bodyMessage = isApproved
    ? `Congratulations! Your product listing "<strong>${escapeHtml(productTitle)}</strong>" has been approved and is now live on the ${escapeHtml(brand)} storefront.`
    : `Your product listing "<strong>${escapeHtml(productTitle)}</strong>" was not approved at this time.${reason ? ` Reason: ${escapeHtml(reason)}` : ' Please review your listing details and update your submission in your seller dashboard.'}`;

  const html = renderEmailLayout({
    headline,
    contentHtml: `
      <p>Hello <strong>${escapeHtml(vendorName || 'Seller')}</strong>,</p>
      <p>${bodyMessage}</p>
      <div style="margin: 20px 0; padding: 14px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 14px;">
        <p style="margin: 0; color: #4b5563;"><strong>Product ID:</strong> ${escapeHtml(productId)}</p>
        <p style="margin: 4px 0 0; color: #4b5563;"><strong>Product Title:</strong> ${escapeHtml(productTitle)}</p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 6px;">
          ${ctaText}
        </a>
      </div>
    `,
    footerNote: `Seller Catalog Update — ${escapeHtml(brand)}`
  });

  return sendAdminEmail({
    to: vendorEmail,
    subject,
    text: `Hello ${vendorName},\n\n${headline}\n\n${productTitle}\n\n${bodyMessage.replace(/<[^>]+>/g, '')}\n\n${ctaUrl}\n\n${brand} Team`,
    html,
    category: `Product Status: ${status}`
  });
};

/**
 * 11. Customer Order Confirmation Email
 */
export const sendOrderConfirmationEmail = async ({
  order,
  items = [],
  customerEmail,
  customerName
}) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();
  const trackUrl = `${frontendUrl}/track-order?orderId=${encodeURIComponent(order.id)}`;

  const itemsHtml = items.map((item) => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 10px 0;">
        <strong>${escapeHtml(item.title)}</strong>
        ${item.variant ? `<br/><span style="font-size: 12px; color: #6b7280;">Variant: ${escapeHtml(item.variant)}</span>` : ''}
        ${item.vendorName ? `<br/><span style="font-size: 11px; color: #9ca3af;">Sold by: ${escapeHtml(item.vendorName)}</span>` : ''}
      </td>
      <td style="padding: 10px 0; text-align: center; color: #4b5563;">${escapeHtml(item.quantity)}</td>
      <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #111827;">₹${Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)}</td>
    </tr>
  `).join('');

  const html = renderEmailLayout({
    headline: `Order Confirmation #${order.id}`,
    contentHtml: `
      <p>Hello <strong>${escapeHtml(customerName || 'Customer')}</strong>,</p>
      <p>Thank you for shopping with ${escapeHtml(brand)}! Your order <strong>#${escapeHtml(order.id)}</strong> has been successfully placed and is now being processed.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; text-transform: uppercase;">
            <th style="padding: 8px 0; text-align: left;">Item</th>
            <th style="padding: 8px 0; text-align: center;">Qty</th>
            <th style="padding: 8px 0; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding: 12px 0 4px; text-align: right; color: #6b7280; font-size: 13px;">Subtotal:</td>
            <td style="padding: 12px 0 4px; text-align: right; color: #374151;">₹${escapeHtml(order.subtotal || order.total)}</td>
          </tr>
          ${Number(order.discount || 0) > 0 ? `
          <tr>
            <td colspan="2" style="padding: 4px 0; text-align: right; color: #059669; font-size: 13px;">Discount:</td>
            <td style="padding: 4px 0; text-align: right; color: #059669;">-₹${escapeHtml(order.discount)}</td>
          </tr>` : ''}
          <tr>
            <td colspan="2" style="padding: 4px 0; text-align: right; color: #6b7280; font-size: 13px;">Shipping:</td>
            <td style="padding: 4px 0; text-align: right; color: #374151;">₹${escapeHtml(order.shipping || 0)}</td>
          </tr>
          <tr style="border-top: 1px solid #e5e7eb;">
            <td colspan="2" style="padding: 8px 0; text-align: right; font-weight: 700; color: #111827;">Total Paid:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px; color: #0e5c4a;">₹${escapeHtml(order.total)}</td>
          </tr>
        </tfoot>
      </table>

      ${order.shippingAddress ? `
      <div style="background-color: #f9fafb; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 13px; color: #4b5563;">
        <strong style="color: #111827;">Shipping Address:</strong><br/>
        ${escapeHtml(order.shippingAddress)}
      </div>` : ''}

      <div style="text-align: center; margin: 28px 0;">
        <a href="${trackUrl}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 6px;">
          Track Your Order &rarr;
        </a>
      </div>
    `,
    footerNote: `Order #${escapeHtml(order.id)} confirmation from ${escapeHtml(brand)}.`
  });

  return sendAdminEmail({
    to: customerEmail || order.customerEmail,
    subject: `Order Confirmation #${order.id} — ${brand}`,
    text: `Hello ${customerName || 'Customer'},\n\nThank you for your order #${order.id} with ${brand}!\nTotal: ₹${order.total}\n\nTrack your order: ${trackUrl}\n\n${brand} Team`,
    html,
    category: 'Order Confirmation'
  });
};

/**
 * 12. Payment Confirmation & Status Email
 */
export const sendPaymentStatusEmail = async ({
  order,
  paymentStatus = 'paid',
  paymentMethod = 'Online',
  transactionReference = '',
  customerEmail,
  customerName
}) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const isPaid = paymentStatus === 'paid';
  const frontendUrl = getFrontendUrl();
  const trackUrl = `${frontendUrl}/track-order?orderId=${encodeURIComponent(order.id)}`;

  const subject = isPaid
    ? `Payment Received for Order #${order.id} — ${brand}`
    : `Payment Status Update for Order #${order.id} — ${brand}`;

  const html = renderEmailLayout({
    headline: isPaid ? 'Payment Received' : 'Payment Status Update',
    contentHtml: `
      <p>Hello <strong>${escapeHtml(customerName || 'Customer')}</strong>,</p>
      <p>${isPaid
        ? `We have received your payment of <strong>₹${escapeHtml(order.total)}</strong> for Order <strong>#${escapeHtml(order.id)}</strong>.`
        : `Your payment status for Order <strong>#${escapeHtml(order.id)}</strong> has been updated to <strong>${escapeHtml(paymentStatus)}</strong>.`}</p>
      
      <div style="background-color: #f9fafb; padding: 14px 18px; border-radius: 6px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0; color: #4b5563;"><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
        <p style="margin: 4px 0 0; color: #4b5563;"><strong>Amount:</strong> ₹${escapeHtml(order.total)}</p>
        <p style="margin: 4px 0 0; color: #4b5563;"><strong>Payment Method:</strong> ${escapeHtml(paymentMethod)}</p>
        ${transactionReference ? `<p style="margin: 4px 0 0; color: #4b5563;"><strong>Transaction Reference:</strong> ${escapeHtml(transactionReference)}</p>` : ''}
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${trackUrl}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 26px; font-weight: 600; font-size: 14px; border-radius: 6px;">
          View Order Details
        </a>
      </div>
    `,
    footerNote: `Official Payment Notification — ${escapeHtml(brand)}`
  });

  return sendAdminEmail({
    to: customerEmail || order.customerEmail,
    subject,
    text: `Hello ${customerName || 'Customer'},\n\nPayment update for order #${order.id}: ${paymentStatus.toUpperCase()} (₹${order.total}).\n\n${brand} Team`,
    html,
    category: 'Payment Status'
  });
};

/**
 * 13. Order Shipment and Delivery Notifications
 */
export const sendOrderFulfillmentStatusEmail = async ({
  order,
  newStatus,
  customerEmail,
  customerName
}) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();
  const trackUrl = `${frontendUrl}/track-order?orderId=${encodeURIComponent(order.id)}`;

  const isDelivered = newStatus === 'Delivered';
  const subject = isDelivered
    ? `Your Order #${order.id} has been Delivered! — ${brand}`
    : `Your Order #${order.id} has been Shipped! — ${brand}`;

  const headline = isDelivered ? 'Order Delivered!' : 'Order on Its Way!';
  const message = isDelivered
    ? `Great news! Your order <strong>#${escapeHtml(order.id)}</strong> has been successfully delivered. We hope you love your purchase!`
    : `Exciting news! Your order <strong>#${escapeHtml(order.id)}</strong> has been handed over to our courier partner and is on its way to you.`;

  const html = renderEmailLayout({
    headline,
    contentHtml: `
      <p>Hello <strong>${escapeHtml(customerName || 'Customer')}</strong>,</p>
      <p>${message}</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${trackUrl}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 6px;">
          Track Package Status
        </a>
      </div>
    `,
    footerNote: `Order fulfillment notification from ${escapeHtml(brand)}.`
  });

  return sendAdminEmail({
    to: customerEmail || order.customerEmail,
    subject,
    text: `Hello ${customerName || 'Customer'},\n\nOrder #${order.id} status update: ${newStatus}!\n\nTrack: ${trackUrl}\n\n${brand} Team`,
    html,
    category: `Order ${newStatus}`
  });
};

/**
 * 14. Order Refund and Cancellation Notifications
 */
export const sendOrderCancellationEmail = async ({
  order,
  customerEmail,
  customerName,
  reason = 'Order cancelled'
}) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();
  const shopUrl = `${frontendUrl}/shop`;

  const html = renderEmailLayout({
    headline: `Order Cancellation #${order.id}`,
    contentHtml: `
      <p>Hello <strong>${escapeHtml(customerName || 'Customer')}</strong>,</p>
      <p>Your order <strong>#${escapeHtml(order.id)}</strong> has been cancelled.</p>
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 14px 18px; border-radius: 6px; margin: 20px 0; font-size: 14px; color: #991b1b;">
        <p style="margin: 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        <p style="margin: 4px 0 0;"><strong>Amount:</strong> ₹${escapeHtml(order.total)}</p>
      </div>
      <p style="font-size: 13px; color: #6b7280;">If any payment was debited, your refund will be processed back to your original payment method within 5-7 business days.</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${shopUrl}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 6px;">
          Continue Shopping
        </a>
      </div>
    `,
    footerNote: `Order Cancellation Notice — ${escapeHtml(brand)}`
  });

  return sendAdminEmail({
    to: customerEmail || order.customerEmail,
    subject: `Order Cancellation Confirmation #${order.id} — ${brand}`,
    text: `Hello ${customerName || 'Customer'},\n\nYour order #${order.id} has been cancelled. Reason: ${reason}\n\n${brand} Team`,
    html,
    category: 'Order Cancellation'
  });
};

/**
 * 15. Vendor Account Status Notifications (Approved, Rejected, Deactivated)
 */
export const sendVendorAccountStatusEmail = async ({ email, name, status }) => {
  const brand = process.env.SENDER_NAME || 'EcShopping';
  const frontendUrl = getFrontendUrl();

  let subject = '';
  let headline = '';
  let bodyMessage = '';
  let ctaText = '';
  let ctaUrl = '';

  if (status === 'approved') {
    subject = `Your seller account has been approved — ${brand}`;
    headline = 'Seller Account Approved!';
    bodyMessage = `Congratulations! Your seller application on ${escapeHtml(brand)} has been approved by our admin team. You can now log in to the Seller Portal, manage your inventory, and list products for sale.`;
    ctaText = 'Access Seller Portal';
    ctaUrl = `${frontendUrl}/login`;
  } else if (status === 'rejected') {
    subject = `Your seller application update — ${brand}`;
    headline = 'Seller Application Update';
    bodyMessage = `Thank you for your interest in selling on ${escapeHtml(brand)}. After review, your seller application could not be approved at this time. If you have questions, please reply to this email or contact our support team.`;
    ctaText = 'Contact Support';
    ctaUrl = `${frontendUrl}/contact`;
  } else if (status === 'deactivated') {
    subject = `Your seller account status update — ${brand}`;
    headline = 'Seller Account Deactivated';
    bodyMessage = `Your seller account on ${escapeHtml(brand)} has been deactivated by the administrator. Your active listings have been archived. If you have questions regarding your account status, please contact support.`;
    ctaText = 'Contact Support';
    ctaUrl = `${frontendUrl}/contact`;
  } else {
    return false;
  }

  const html = renderEmailLayout({
    headline,
    contentHtml: `
      <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
      <p>${bodyMessage}</p>
      ${ctaUrl ? `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background-color: #0e5c4a; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 6px;">
          ${ctaText}
        </a>
      </div>` : ''}
    `,
    footerNote: `Operational Seller Notice — ${escapeHtml(brand)}`
  });

  return sendAdminEmail({
    to: email,
    subject,
    text: `Hello ${name},\n\n${bodyMessage}\n\n${ctaUrl ? `Link: ${ctaUrl}\n\n` : ''}${brand} Team`,
    html,
    category: `Vendor Account ${status}`
  });
};
