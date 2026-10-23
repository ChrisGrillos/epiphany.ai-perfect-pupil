import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities ──
const SCHEMA_ASSUMPTIONS = Object.freeze({ ownerFields: ['created_by', 'owner_id', 'user_id'] });
const TIER_CONFIG = Object.freeze({ free: { rank: 0, maxPupils: 2, monthlyAiCalls: 100, isPaid: false }, basic: { rank: 1, maxPupils: 5, monthlyAiCalls: 500, isPaid: true }, premium: { rank: 2, maxPupils: 10, monthlyAiCalls: 2000, isPaid: true }, elite: { rank: 3, maxPupils: 20, monthlyAiCalls: 10000, isPaid: true } });
const TIER_ALIASES = Object.freeze({ plus: 'basic', pro: 'premium', family: 'premium', team: 'elite', enterprise: 'elite' });
function uniqueStrings(values) { return Array.from(new Set(values.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))); }
function buildUserOwnerKeys(user) { return uniqueStrings([user?.id, user?.user_id, user?.sub, user?.email]); }
function normalizeTier(rawTier) { const n = String(rawTier || 'free').trim().toLowerCase(); const c = TIER_ALIASES[n] || n; return TIER_CONFIG[c] ? c : 'free'; }
function tierRank(rawTier) { return TIER_CONFIG[normalizeTier(rawTier)]?.rank ?? 0; }
function isTierAtLeast(current, required) { return tierRank(current) >= tierRank(required); }
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
  const sub = ranked.find(r => r?.is_active !== false) || ranked[0] || null;
  const tier = normalizeTier(sub?.tier || 'free'); const config = TIER_CONFIG[tier] || TIER_CONFIG.free;
  return { tier, is_paid: config.isPaid, max_pupils_allowed: config.maxPupils, monthly_ai_call_limit: config.monthlyAiCalls, subscription: sub };
}

// ── Handler ──
const PROVIDER_RULES = { default: { minTier: 'free', requiresKey: false }, openai: { minTier: 'premium', requiresKey: true, models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] }, anthropic: { minTier: 'premium', requiresKey: true, models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] }, grok: { minTier: 'elite', requiresKey: true, models: ['grok-1', 'grok-2'] }, custom: { minTier: 'elite', requiresKey: true } };
function sortByRecency(rows) { return [...(rows || [])].sort((a, b) => new Date(b?.updated_date || b?.created_date || 0).getTime() - new Date(a?.updated_date || a?.created_date || 0).getTime()); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const providerName = String(payload?.provider_name || 'default').trim().toLowerCase();
    const providerRules = PROVIDER_RULES[providerName];
    if (!providerRules) return Response.json({ error: `Unsupported provider: ${providerName}` }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, providerRules.minTier)) return Response.json({ error: `${providerName} requires the ${providerRules.minTier} tier.` }, { status: 403 });

    const rows = sortByRecency(await listOwnedRecords(base44, 'AIProviderConfig', ownerKeys));
    const primary = rows[0] || null;
    const apiKey = String(payload?.api_key || '').trim() || String(primary?.api_key || '').trim() || null;
    if (providerRules.requiresKey && !apiKey) return Response.json({ error: `${providerName} requires an API key.` }, { status: 400 });

    const requestedModel = payload?.model_name ? String(payload.model_name).trim() : '';
    if (providerRules.models && requestedModel && !providerRules.models.includes(requestedModel)) return Response.json({ error: `Model ${requestedModel} is not supported for ${providerName}.` }, { status: 400 });

    const fallbackToDefault = payload?.fallback_to_default !== false;
    const apiEndpoint = providerName === 'custom' ? String(payload?.api_endpoint || '').trim() : null;
    if (providerName === 'custom' && !apiEndpoint) return Response.json({ error: 'Custom provider requires api_endpoint.' }, { status: 400 });

    const upsertPayload = { provider_name: providerName, api_endpoint: apiEndpoint, model_name: requestedModel || null, fallback_to_default: fallbackToDefault, call_limit: entitlements.monthly_ai_call_limit, monthly_api_calls: Number(primary?.monthly_api_calls || 0), is_active: true, last_used: new Date().toISOString() };
    if (apiKey) upsertPayload.api_key = apiKey;

    let config = null;
    if (primary?.id) {
      config = await base44.asServiceRole.entities.AIProviderConfig.update(primary.id, upsertPayload);
      for (const row of rows.slice(1)) { if (row?.id) await base44.asServiceRole.entities.AIProviderConfig.update(row.id, { is_active: false }); }
    } else {
      config = await base44.entities.AIProviderConfig.create(upsertPayload);
    }

    return Response.json({ success: true, config: { ...config, api_key: config?.api_key ? '********' : null }, tier: entitlements.tier, monthly_ai_call_limit: entitlements.monthly_ai_call_limit });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});