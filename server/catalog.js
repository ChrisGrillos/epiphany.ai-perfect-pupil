export const CATALOG = [
  { name: 'Berry Delight', description: 'A small happiness boost', category: 'treat', effect_type: 'happiness', effect_value: 15, rarity: 'common' },
  { name: 'Cosmic Cookie', description: 'A filling snack', category: 'treat', effect_type: 'hunger', effect_value: 25, rarity: 'uncommon' },
  { name: 'Brain Boost', description: 'Adds companion knowledge points', category: 'vitamin', effect_type: 'knowledge', effect_value: 10, rarity: 'common' },
  { name: 'Energy Elixir', description: 'Adds fitness points', category: 'vitamin', effect_type: 'fitness', effect_value: 15, rarity: 'uncommon' },
].map(item => ({ ...item, price: 0, required_tier: 'free' }));

export function seedStore(store) {
  if (!store.list('Subscription').length) store.create('Subscription', { tier: 'elite', monthly_price: 0, is_active: true, local_edition: true });
  if (!store.list('StoreItem').length) for (const item of CATALOG) store.create('StoreItem', item);
}
