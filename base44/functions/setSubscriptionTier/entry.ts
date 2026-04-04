import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities ──
const SCHEMA_ASSUMPTIONS = Object.freeze({ ownerFields: ['created_by', 'owner_id', 'user_id'] });
const TIER_CONFIG = Object.freeze({ free: { rank: 0, maxPupils: 2, monthlyAiCalls: 100, isPaid: false }, basic: { rank: 1, maxPupils: 5, monthlyAiCalls: 500, isPaid: true }, premium: { rank: 2, maxPupils: 10, monthlyAiCalls: 2000, isPaid: true }, elite: { rank: 3, maxPupils: 20, monthlyAiCalls: 10000, isPaid: true } });
const TIER_ALIASES = Object.freeze({ plus: 'basic', pro: 'premium', family: 'premium', team: 'elite', enterprise: 'elite' });
function uniqueStrings(values) { return Array.from(new Set(values.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))); }
function buildUserOwnerKeys(user) { return uniqueStrings([user?.id, user?.user_id, user?.sub, user?.email]); }
function normalizeTier(rawTier) { const n = String(rawTier || 'free').trim().toLowerCase(); const c = TIER_ALIASES[n] || n; return TIER_CONFIG[c] ? c : 'free'; }
function tierRank(rawTier) { return TIER_CONFIG[normalizeTier(rawTier)]?.rank ?? 0; }
function getMaxPupilsForTier(rawTier) { return TIER_CONFIG[normalizeTier(rawTier)]?.maxPupils ?? 2; }
function dedupeById(rows) { const out = []; const seen = new Set(); for (const row of rows || []) { const id = String(row?.id || ''); if (!id || seen.has(id)) continue; seen.add(id); out.push(row); } return out; }
async function tryFilterMany(ea, filters) { const rows = []; for (const f of filters) { try { const res = await ea.filter(f); if (Array.isArray(res)) rows.push(...res); } catch {} } return dedupeById(rows); }
async function listOwnedRecords(base44, entityName, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.[entityName]; const usr = base44?.entities?.[entityName];
  const ownerFilters = ownerKeys.flatMap(k => SCHEMA_ASSUMPTIONS.ownerFields.map(f => ({ [f]: k })));
  if (svc?.filter && ownerFilters.length > 0) { const rows = await tryFilterMany(svc, ownerFilters); if (rows.length > 0) return rows; }
  if (usr?.list) { try { const rows = await usr.list(); return Array.isArray(rows) ? rows : []; } catch {} }
  if (usr?.filter) { try { const rows = await usr.filter({}); return Array.isArray(rows) ? rows : []; } catch {} }
  return [];
}
async function getUserCurrencyRecord(base44, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.UserCurrency; const usr = base44?.entities?.UserCurrency;
  const ownerFilters = ownerKeys.flatMap(k => SCHEMA_ASSUMPTIONS.ownerFields.map(f => ({ [f]: k })));
  if (svc?.filter) { const rows = await tryFilterMany(svc, ownerFilters); if (rows.length > 0) return rows[0]; }
  if (usr?.filter) { try { const rows = await usr.filter({}); return Array.isArray(rows) && rows.length > 0 ? rows[0] : null; } catch {} }
  return null;
}
async function listSubscriptionRows(base44, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.Subscription; const usr = base44?.entities?.Subscription;
  const ownerFilters = ownerKeys.flatMap(k => SCHEMA_ASSUMPTIONS.ownerFields.map(f => ({ [f]: k })));
  let rows = []; if (svc?.filter) { rows = await tryFilterMany(svc, ownerFilters); }
  if (rows.length === 0 && usr?.filter) { try { const scoped = await usr.filter({}); if (Array.isArray(scoped)) rows = scoped; } catch {} }
  return rows;
}
async function resolveUserEntitlements(base44, ownerKeys) {
  const rows = await listSubscriptionRows(base44, ownerKeys);
  const ranked = [...rows].sort((a, b) => { const aA = a?.is_active === false ? 0 : 1; const bA = b?.is_active === false ? 0 : 1; if (bA !== aA) return bA - aA; const rd = tierRank(b?.tier) - tierRank(a?.tier); if (rd !== 0) return rd; return new Date(b?.updated_date || b?.created_date || 0).getTime() - new Date(a?.updated_date || a?.created_date || 0).getTime(); });
  const subscription = ranked.find(r => r?.is_active !== false) || ranked[0] || null;
  const tier = normalizeTier(subscription?.tier || 'free'); const config = TIER_CONFIG[tier] || TIER_CONFIG.free;
  return { tier, is_paid: config.isPaid, max_pupils_allowed: config.maxPupils, monthly_ai_call_limit: config.monthlyAiCalls, subscription };
}

// ── Handler ──
const MONTHLY_PRICES = { free: 0, basic: 0.99, premium: 4.99, elite: 9.99 };
const TIER_FEATURES = { free: ['basic_view', 'limited_chat'], basic: ['full_care', 'unlimited_chat', 'store_access', 'brain_export', 'achievements'], premium: ['full_care', 'unlimited_chat', 'store_access', 'brain_export', 'achievements', 'evolution_control', 'customization'], elite: ['full_care', 'unlimited_chat', 'store_access', 'brain_export', 'achievements', 'evolution_control', 'customization', 'puzzles', 'advanced_personalization'] };
function sortByRecency(rows) { return [...(rows || [])].sort((a, b) => new Date(b?.updated_date || b?.created_date || 0).getTime() - new Date(a?.updated_date || a?.created_date || 0).getTime()); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const requestedTier = normalizeTier(payload?.tier);
    if (!MONTHLY_PRICES.hasOwnProperty(requestedTier)) return Response.json({ error: 'Invalid subscription tier.' }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const companions = await listOwnedRecords(base44, 'Companion', ownerKeys);
    const companionCount = companions.length;
    const maxForRequestedTier = getMaxPupilsForTier(requestedTier);

    if (companionCount > maxForRequestedTier) {
      return Response.json({ error: `Cannot switch to ${requestedTier}: you currently have ${companionCount} pupils, but ${requestedTier} allows only ${maxForRequestedTier}.`, code: 'DOWNGRADE_BLOCKED_BY_PUPIL_COUNT', current_pupils: companionCount, max_pupils_allowed: maxForRequestedTier }, { status: 409 });
    }

    const subscriptionRows = sortByRecency(await listOwnedRecords(base44, 'Subscription', ownerKeys));
    const primary = subscriptionRows[0] || null;
    const subscriptionPayload = { tier: requestedTier, monthly_price: MONTHLY_PRICES[requestedTier], is_active: true, features: TIER_FEATURES[requestedTier] };

    let subscription = null;
    if (primary?.id) {
      subscription = await base44.asServiceRole.entities.Subscription.update(primary.id, subscriptionPayload);
      for (const row of subscriptionRows.slice(1)) { if (row?.id) await base44.asServiceRole.entities.Subscription.update(row.id, { is_active: false }); }
    } else {
      subscription = await base44.entities.Subscription.create(subscriptionPayload);
    }

    const currency = await getUserCurrencyRecord(base44, ownerKeys);
    if (currency?.id) { await base44.asServiceRole.entities.UserCurrency.update(currency.id, { max_pupils_allowed: maxForRequestedTier }); }
    else { await base44.entities.UserCurrency.create({ pcp_balance: 0, free_pupils_count: companionCount, max_pupils_allowed: maxForRequestedTier }); }

    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    return Response.json({ success: true, subscription, tier: entitlements.tier, max_pupils_allowed: entitlements.max_pupils_allowed, current_pupils: companionCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});