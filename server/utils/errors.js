// Central helpers for safe error responses. Internal exception details are
// logged server-side only; clients always receive generic 5xx messages.

const GENERIC_500 = 'Something went wrong. Please try again.';

export const fail = (res, status, message) =>
  res.status(status).json({ success: false, error: message });

export const sendDbError = (res, err, label) => {
  console.error(`❌ [${label || 'db'}] code=${err?.code || 'n/a'} message=${err?.message || 'n/a'}`);
  return res.status(500).json({ success: false, error: GENERIC_500 });
};

export const sendInternalError = (res, err, label) => {
  console.error(`❌ [${label || 'internal'}] code=${err?.code || ''} message=${err?.message || ''}`);
  return res.status(500).json({ success: false, error: GENERIC_500 });
};

export const GENERIC_ERROR = GENERIC_500;
