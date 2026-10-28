import { get, insert, update } from '../db.js';

/**
 * Apply a stock movement. qty positive = stock in, negative = stock out.
 * For returnable bottles, a sale (stock out) of whole bottles automatically
 * creates empties on hand (the guest leaves the empty bottle behind).
 */
export function moveStock(inventory_item_id, qty, type, ref = null, note = null, user_id = null) {
  const item = get('SELECT * FROM inventory_items WHERE id=?', [inventory_item_id]);
  if (!item) throw new Error('Inventory item not found');
  const q = Number(qty);
  if (!q) return item;
  const patch = { qty_on_hand: Math.round((item.qty_on_hand + q) * 1000) / 1000 };
  if (item.returnable_bottle && ['sale', 'return'].includes(type) && Number.isInteger(q)) {
    patch.empties_on_hand = Math.max(0, item.empties_on_hand - q); // sale (q<0) adds empties; return (q>0) removes
  }
  update('inventory_items', inventory_item_id, patch);
  insert('stock_movements', { inventory_item_id, qty: q, type, ref, note, user_id });
  return get('SELECT * FROM inventory_items WHERE id=?', [inventory_item_id]);
}
