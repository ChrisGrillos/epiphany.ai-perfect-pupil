import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities (Base44 functions cannot import local files) ──

const SCHEMA_ASSUMPTIONS = Object.freeze({
  ownerFields: ['created_by', 'owner_id', 'user_id'],
  paidTiers: ['basic', 'premium', 'elite', 'plus', 'pro', 'family', 'enterprise', 'team']
});

const TIER_CONFIG = Object.freeze({
  free:    { rank: 0, maxPupils: 2,  monthlyAiCalls: 100,   isPaid: false },
  basic:   { rank: 1, maxPupils: 5,  monthlyAiCalls: 500,   isPaid: true },
  premium: { rank: 2, maxPupils: 10, monthlyAiCalls: 2000,  isPaid: true },
  elite:   { rank: 3, maxPupils: 20, monthlyAiCalls: 10000, isPaid: true }
});

const TIER_ALIASES = Object.freeze({ plus: 'basic', pro: 'premium', family: 'premium', team: 'elite', enterprise: 'elite' });

function uniqueStrings(values) {
  return Array.from(new Set(values.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean)));
}
function buildUserOwnerKeys(user) {
  return uniqueStrings([user?.id, user?.user_id, user?.sub, user?.email]);
}
function normalizeTier(rawTier) {
  const normalized = String(rawTier || 'free').trim().toLowerCase();
  const canonical = TIER_ALIASES[normalized] || normalized;
  return TIER_CONFIG[canonical] ? canonical : 'free';
}
function tierRank(rawTier) { return TIER_CONFIG[normalizeTier(rawTier)]?.rank ?? 0; }

function dedupeById(rows) {
  const out = []; const seen = new Set();
  for (const row of rows || []) { const id = String(row?.id || ''); if (!id || seen.has(id)) continue; seen.add(id); out.push(row); }
  return out;
}
async function tryFilterMany(entityAccessor, filters) {
  const rows = [];
  for (const f of filters) { try { const res = await entityAccessor.filter(f); if (Array.isArray(res)) rows.push(...res); } catch {} }
  return dedupeById(rows);
}
async function listOwnedRecords(base44, entityName, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.[entityName];
  const usr = base44?.entities?.[entityName];
  const ownerFilters = ownerKeys.flatMap(k => SCHEMA_ASSUMPTIONS.ownerFields.map(f => ({ [f]: k })));
  if (svc?.filter && ownerFilters.length > 0) { const rows = await tryFilterMany(svc, ownerFilters); if (rows.length > 0) return rows; }
  if (usr?.list) { try { const rows = await usr.list(); return Array.isArray(rows) ? rows : []; } catch {} }
  if (usr?.filter) { try { const rows = await usr.filter({}); return Array.isArray(rows) ? rows : []; } catch {} }
  return [];
}
async function listSubscriptionRows(base44, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.Subscription;
  const usr = base44?.entities?.Subscription;
  const ownerFilters = ownerKeys.flatMap(k => SCHEMA_ASSUMPTIONS.ownerFields.map(f => ({ [f]: k })));
  let rows = [];
  if (svc?.filter) { rows = await tryFilterMany(svc, ownerFilters); }
  if (rows.length === 0 && usr?.filter) { try { const scoped = await usr.filter({}); if (Array.isArray(scoped)) rows = scoped; } catch {} }
  return rows;
}
async function resolveUserEntitlements(base44, ownerKeys) {
  const rows = await listSubscriptionRows(base44, ownerKeys);
  const ranked = [...rows].sort((a, b) => {
    const aActive = a?.is_active === false ? 0 : 1; const bActive = b?.is_active === false ? 0 : 1;
    if (bActive !== aActive) return bActive - aActive;
    const rankDelta = tierRank(b?.tier) - tierRank(a?.tier); if (rankDelta !== 0) return rankDelta;
    return new Date(b?.updated_date || b?.created_date || 0).getTime() - new Date(a?.updated_date || a?.created_date || 0).getTime();
  });
  const subscription = ranked.find(row => row?.is_active !== false) || ranked[0] || null;
  const tier = normalizeTier(subscription?.tier || 'free');
  const config = TIER_CONFIG[tier] || TIER_CONFIG.free;
  return { tier, is_paid: config.isPaid, max_pupils_allowed: config.maxPupils, monthly_ai_call_limit: config.monthlyAiCalls, subscription };
}

// ── Handler ──

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    const companions = await listOwnedRecords(base44, 'Companion', ownerKeys);

    return Response.json({
      tier: entitlements.tier,
      is_paid: entitlements.is_paid,
      max_pupils_allowed: entitlements.max_pupils_allowed,
      monthly_ai_call_limit: entitlements.monthly_ai_call_limit,
      current_pupils: companions.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});