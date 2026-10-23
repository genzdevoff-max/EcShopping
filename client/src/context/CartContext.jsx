import { createContext, useContext } from 'react';

/**
 * Cart state is owned by App.jsx (so existing prop-based pages keep working)
 * and exposed through this context so shared components (ProductCard,
 * CartDrawer, Header) can read/write the cart without prop drilling.
 */
export const CartContext = createContext(null);

export const lineKeyOf = (id, variant) => `${id}::${variant || 'default'}`;

export function useCart() {
  return useContext(CartContext);
}
