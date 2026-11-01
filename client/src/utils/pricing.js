/**
 * Cart pricing helpers and coupon rules.
 * Everything here is frontend-only configuration. When the backend is
 * connected, coupon validation and shipping quotes must move server-side —
 * `validateCoupon` / `computeTotals` are the integration seams.
 */

export const DELIVERY_METHODS = [
  {
    id: 'standard',
    label: 'Standard delivery',
    detail: '3–5 business days',
    price: 50,
    freeOver: 499
  },
  {
    id: 'express',
    label: 'Express delivery',
    detail: '1–2 business days',
    price: 120,
    freeOver: null
  }
];

/** Coupon rules — no real promotion engine is connected yet. */
export const COUPONS = {
  WELCOME10: {
    code: 'WELCOME10',
    label: '10% off (up to ₹100)',
    type: 'percent',
    value: 10,
    maxDiscount: 100,
    minOrder: 299,
    freeShipping: false
  },
  FRESH50: {
    code: 'FRESH50',
    label: '₹50 off orders above ₹499',
    type: 'flat',
    value: 50,
    maxDiscount: null,
    minOrder: 499,
    freeShipping: false
  },
  FREESHIP: {
    code: 'FREESHIP',
    label: 'Free standard shipping',
    type: 'shipping',
    value: 0,
    maxDiscount: null,
    minOrder: 0,
    freeShipping: true
  },
  HARVEST20: {
    code: 'HARVEST20',
    label: '20% off (up to ₹250) above ₹999',
    type: 'percent',
    value: 20,
    maxDiscount: 250,
    minOrder: 999,
    freeShipping: false
  }
};

export function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^0-9.]+/g, ' ').trim();
  const first = cleaned.split(/[\s-]+/)[0];
  const num = parseFloat(first);
  return Number.isFinite(num) ? num : 0;
}

export function formatINR(value, { decimals = false } = {}) {
  const num = Number(value) || 0;
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0
  })}`;
}

export function discountPercent(price, compareAt) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function getDeliveryMethod(id) {
  return DELIVERY_METHODS.find((m) => m.id === id) || DELIVERY_METHODS[0];
}

/**
 * Validates a coupon against the rules above.
 * Returns `{ ok, coupon, discount, freeShipping, message }`.
 */
export function validateCoupon(rawCode, subtotal) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    return { ok: false, message: 'Enter a coupon code.' };
  }
  const coupon = COUPONS[code];
  if (!coupon) {
    return { ok: false, message: `“${code}” is not a valid coupon code.` };
  }
  if (subtotal < coupon.minOrder) {
    return {
      ok: false,
      coupon,
      message: `Add items worth ${formatINR(coupon.minOrder - subtotal)} more to use ${code}.`
    };
  }
  let discount = 0;
  if (coupon.type === 'percent') {
    discount = Math.min((subtotal * coupon.value) / 100, coupon.maxDiscount || Infinity);
    discount = Math.round(discount);
  } else if (coupon.type === 'flat') {
    discount = Math.min(coupon.value, subtotal);
  }
  return {
    ok: true,
    coupon,
    discount,
    freeShipping: !!coupon.freeShipping,
    message: `${code} applied — ${coupon.label}.`
  };
}

/**
 * Cart totals.
 * @param {object} args
 * @param {Array<{price:number|string, quantity:number, vendorId?:string|null, vendorShipping?:object}>} args.items
 * @param {ReturnType<typeof validateCoupon>|null} args.couponResult
 * @param {string} args.deliveryMethodId
 * @param {object} [args.shippingConfig]
 */
export function computeTotals({ items = [], couponResult = null, deliveryMethodId = 'standard', shippingConfig = null } = {}) {
  const subtotal = items.reduce((sum, item) => sum + parsePrice(item.price) * (item.quantity || 1), 0);
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const standardCharge = shippingConfig?.standardCharge != null ? Number(shippingConfig.standardCharge) : 50;
  const standardFreeThreshold = shippingConfig?.standardFreeThreshold != null ? Number(shippingConfig.standardFreeThreshold) : 499;
  const standardEnabled = shippingConfig?.standardDeliveryEnabled !== false;
  const expressCharge = shippingConfig?.expressCharge != null ? Number(shippingConfig.expressCharge) : 120;
  const expressEnabled = shippingConfig?.expressDeliveryEnabled !== false;
  const handlingFee = (shippingConfig?.handlingFeeEnabled && Number(shippingConfig?.handlingFee) > 0) ? Number(shippingConfig.handlingFee) : 0;

  let effectiveId = deliveryMethodId;
  if (effectiveId === 'express' && !expressEnabled) effectiveId = 'standard';
  if (effectiveId === 'standard' && !standardEnabled && expressEnabled) effectiveId = 'express';

  const defaultMethod = getDeliveryMethod(effectiveId);
  const method = {
    ...defaultMethod,
    id: effectiveId,
    price: effectiveId === 'express' ? expressCharge : standardCharge,
    freeOver: effectiveId === 'express' ? null : standardFreeThreshold
  };

  const adminItems = items.filter((i) => !i.vendorId || i.vendorId === 'admin');
  const vendorItems = items.filter((i) => i.vendorId && i.vendorId !== 'admin');

  let adminShipping = 0;
  if (adminItems.length > 0) {
    const adminSubtotal = adminItems.reduce((sum, i) => sum + parsePrice(i.price) * (i.quantity || 1), 0);
    adminShipping = (method.freeOver != null && adminSubtotal >= method.freeOver) ? 0 : method.price;
  }

  let vendorShippingTotal = 0;
  const vendorShippingMap = shippingConfig?.vendorShipping || {};
  const vendorGroups = {};
  for (const item of vendorItems) {
    const vId = String(item.vendorId);
    if (!vendorGroups[vId]) {
      vendorGroups[vId] = {
        vendorId: vId,
        seller: item.seller || item.vendorName || 'Vendor Direct',
        subtotal: 0,
        items: []
      };
    }
    vendorGroups[vId].subtotal += parsePrice(item.price) * (item.quantity || 1);
    vendorGroups[vId].items.push(item);
  }

  const vendorBreakdowns = [];
  for (const vId of Object.keys(vendorGroups)) {
    const group = vendorGroups[vId];
    const vConfig = vendorShippingMap[vId] || group.items[0]?.vendorShipping || {};
    const isEnabled = vConfig.shippingEnabled !== false;
    const vCharge = vConfig.shippingCharge != null ? Number(vConfig.shippingCharge) : 0;
    const vFreeOver = vConfig.shippingFreeThreshold != null ? Number(vConfig.shippingFreeThreshold) : null;

    let vFee = 0;
    if (isEnabled && vCharge > 0) {
      if (vFreeOver != null && group.subtotal >= vFreeOver) {
        vFee = 0;
      } else {
        vFee = vCharge;
      }
    }
    vendorShippingTotal += vFee;
    vendorBreakdowns.push({
      vendorId: vId,
      name: vConfig.storeName || group.seller,
      charge: vFee,
      isFree: vFee === 0 && vCharge > 0
    });
  }

  let shipping = adminShipping + vendorShippingTotal;
  if (items.length === 0) shipping = 0;

  let discount = 0;
  if (couponResult && couponResult.ok) {
    discount = couponResult.discount || 0;
    if (couponResult.freeShipping) shipping = 0;
  }

  const total = Math.max(0, subtotal - discount) + shipping + handlingFee;
  return {
    subtotal,
    itemCount,
    discount,
    shipping,
    handlingFee,
    total,
    method,
    shippingBreakdown: {
      adminShipping,
      vendorShippingTotal,
      vendorBreakdowns,
      hasAdminItems: adminItems.length > 0,
      hasVendorItems: vendorItems.length > 0
    }
  };
}
