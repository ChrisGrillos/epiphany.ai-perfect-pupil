import { z } from 'zod';
import { LOCAL_USER } from './store.js';
import { httpError } from './schemas.js';

export function addInventoryItem(store, raw) {
  const { item_id } = z.object({ item_id: z.string() }).strict().parse(raw);
  const item = store.get('StoreItem', item_id);
  if (!item) throw httpError('Item not found', 404);
  const existing = store.list('Inventory', { item_id }, undefined, 1, LOCAL_USER.id)[0];
  if (existing && existing.quantity >= 99) throw httpError('You already have 99 of this item.');
  return existing ? store.update('Inventory', existing.id, { quantity: existing.quantity + 1 }) : store.create('Inventory', { item_id, item_name: item.name, quantity: 1 });
}

export function useInventoryItem(store, raw) {
  const { inventory_id, companion_id } = z.object({ inventory_id: z.string(), companion_id: z.string() }).strict().parse(raw);
  const inventory = store.get('Inventory', inventory_id, LOCAL_USER.id);
  const companion = store.get('Companion', companion_id, LOCAL_USER.id);
  if (!inventory || !companion || inventory.quantity < 1) throw httpError('Item or companion not found', 404);
  const item = store.get('StoreItem', inventory.item_id);
  const field = { hunger: 'hunger', happiness: 'happiness', fitness: 'fitness', knowledge: 'knowledge_level' }[item?.effect_type];
  if (!field) throw httpError('This item cannot be used.');
  const updated = store.update('Companion', companion_id, { [field]: Math.min(100, companion[field] + item.effect_value) });
  if (inventory.quantity === 1) store.delete('Inventory', inventory.id);
  else store.update('Inventory', inventory.id, { quantity: inventory.quantity - 1 });
  store.create('InteractionLog', { companion_id, action_type: 'use_item', details: { item: item.name } });
  return { companion: updated };
}
