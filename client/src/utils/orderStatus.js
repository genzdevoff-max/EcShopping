/** Shared order status helpers for the customer-facing order pages. */

export const ORDER_STATUS_FLOW = ['Processing', 'Shipped', 'Delivered'];

export const ORDER_STATUS_LABELS = {
  processing: 'Order Placed & Processing',
  shipped: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  // Backwards-compatible aliases
  confirmed: 'Order Placed & Processing',
  packed: 'Order Placed & Processing',
  out_for_delivery: 'Dispatched',
  Processing: 'Order Placed & Processing',
  Shipped: 'Dispatched',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled'
};

export const ORDER_STATUS_DESCRIPTIONS = {
  processing: 'Seller is preparing your items and assigning courier dispatch.',
  shipped: 'Your parcel is in transit and on the way to your delivery address.',
  delivered: 'Your order has been safely delivered to your doorstep.',
  cancelled: 'This order was cancelled and inventory has been restored.',
  confirmed: 'Seller is preparing your items and assigning courier dispatch.',
  packed: 'Seller is preparing your items and assigning courier dispatch.',
  out_for_delivery: 'Your parcel is out for delivery with our courier partner.'
};

export const STATUS_BADGE_CLASS = {
  processing: 'badge badge-info',
  shipped: 'badge badge-warning',
  delivered: 'badge badge-success',
  cancelled: 'badge badge-danger',
  // Backwards-compatible aliases
  confirmed: 'badge badge-info',
  packed: 'badge badge-warning',
  out_for_delivery: 'badge badge-warning',
  Processing: 'badge badge-info',
  Shipped: 'badge badge-warning',
  Delivered: 'badge badge-success',
  Cancelled: 'badge badge-danger'
};

export const PAYMENT_STATUS_LABELS = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed'
};

export function normalizeOrderStatus(rawStatus = 'Processing') {
  const lower = String(rawStatus || 'Processing').trim().toLowerCase();
  if (lower === 'cancelled') return 'Cancelled';
  if (lower === 'shipped' || lower === 'out_for_delivery') return 'Shipped';
  if (lower === 'delivered') return 'Delivered';
  return 'Processing';
}

export function getTimeline(order = {}) {
  const rawStatus = (order.status || 'Processing').trim();
  const lower = rawStatus.toLowerCase();
  const cancelled = lower === 'cancelled';
  const normalized = normalizeOrderStatus(rawStatus);

  const currentIndex = cancelled ? -1 : ORDER_STATUS_FLOW.indexOf(normalized);

  return ORDER_STATUS_FLOW.map((id, index) => {
    const key = id.toLowerCase();
    return {
      id,
      label: ORDER_STATUS_LABELS[id] || id,
      description: ORDER_STATUS_DESCRIPTIONS[key] || '',
      done: !cancelled && index < currentIndex,
      current: !cancelled && index === currentIndex
    };
  });
}

export function statusBadgeClass(status = 'Processing') {
  const key = String(status || 'Processing').trim().toLowerCase();
  return STATUS_BADGE_CLASS[key] || 'badge badge-soft';
}

export function statusLabel(status = 'Processing') {
  const key = String(status || 'Processing').trim().toLowerCase();
  return ORDER_STATUS_LABELS[key] || status || 'Order Placed & Processing';
}

export function formatOrderDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '—';
  }
}
