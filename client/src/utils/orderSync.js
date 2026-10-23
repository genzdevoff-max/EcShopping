/**
 * Order-history synchronisation rules.
 *
 * Identity rule: an order is identified by its `id` (string comparison).
 * Rows the server returned are authoritative and replace any local copy
 * with the same id. Local-only rows survive every server response, but they
 * are flagged `serverVerified: false` so the UI can never present them as
 * server-confirmed or paid.
 *
 * Pure functions only — no browser or server dependencies — so they can be
 * unit-tested with plain node --test.
 */

const toIdString = (value) => String(value ?? '');

const dropLocalCopyOf = (serverIds) => (order) => order && !serverIds.has(toIdString(order.id));

/**
 * Merge a server response into the local order cache.
 * @param {Array<object>} serverOrders - orders as hydrated by the server
 * @param {Array<object>} localOrders - current local cache contents
 * @returns {Array<object>} merged list, newest first
 */
export function mergeOrderHistory(serverOrders, localOrders) {
  const server = (Array.isArray(serverOrders) ? serverOrders : [])
    .filter(Boolean)
    .map((order) => ({ ...order, serverVerified: true }));
  const local = (Array.isArray(localOrders) ? localOrders : []).filter(Boolean);

  const serverIds = new Set(server.map((order) => toIdString(order.id)));
  const preserved = local
    .filter(dropLocalCopyOf(serverIds))
    .map((order) => ({ ...order, serverVerified: false }));

  const merged = [...server, ...preserved];
  merged.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  return merged;
}

/**
 * Display label for an order's payment state.
 * Local-only copies must never advertise a client-claimed "paid" state.
 * @param {object} order
 * @param {Record<string, string>} labels - verified-state label map
 * @returns {string}
 */
export function paymentStatusDisplay(order, labels = {}) {
  if (order?.serverVerified === false) {
    return order.paymentStatus === 'paid' ? 'Payment unverified (device copy)' : 'Pending server confirmation';
  }
  return labels[order?.paymentStatus] || '—';
}
