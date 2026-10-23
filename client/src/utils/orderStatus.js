/** Shared order status helpers for the customer-facing order pages. */

export const ORDER_STATUS_FLOW = ['confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export const ORDER_STATUS_LABELS = {
  confirmed: 'Order confirmed',
  packed: 'Packed by seller',
  shipped: 'On the way',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

export const STATUS_BADGE_CLASS = {
  confirmed: 'badge badge-info',
  packed: 'badge badge-warning',
  shipped: 'badge badge-warning',
  out_for_delivery: 'badge badge-warning',
  delivered: 'badge badge-success',
  cancelled: 'badge badge-danger'
};

export const PAYMENT_STATUS_LABELS = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed'
};

export function getTimeline(order = {}) {
  const status = order.status || 'confirmed';
  const cancelled = status === 'cancelled';
  const currentIndex = cancelled ? -1 : ORDER_STATUS_FLOW.indexOf(status);

  return ORDER_STATUS_FLOW.map((id, index) => ({
    id,
    label: ORDER_STATUS_LABELS[id],
    done: !cancelled && index < currentIndex,
    current: !cancelled && index === currentIndex
  }));
}

export function statusBadgeClass(status = 'confirmed') {
  return STATUS_BADGE_CLASS[status] || 'badge badge-soft';
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
