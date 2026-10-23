import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities ──
const SCHEMA_ASSUMPTIONS = Object.freeze({ ownerFields: ['created_by', 'owner_id', 'user_id'], paidTiers: ['basic', 'premium', 'elite'], traitAffinityMin: 0, traitAffinityMax: 100, identityVersion: 2 });
const TIER_CONFIG = Object.freeze({ free: { rank: 0, maxPupils: 2, monthlyAiCalls: 100, isPaid: false }, basic: { rank: 1, maxPupils: 5, monthlyAiCalls: 500, isPaid: true }, premium: { rank: 2, maxPupils: 10, monthlyAiCalls: 2000, isPaid: true }, elite: { rank: 3, maxPupils: 20, monthlyAiCalls: 10000, isPaid: true } });
const TIER_ALIASES = Object.freeze({ plus: 'basic', pro: 'premium', family: 'premium', team: 'elite', enterprise: 'elite' });
function uniqueStrings(values) { return Array.from(new Set(values.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))); }
function buildUserOwnerKeys(user) { return uniqueStrings([user?.id, user?.user_id, user?.sub, user?.email]); }
function normalizeTier(rawTier) { const n = String(rawTier || 'free').trim().toLowerCase(); const c = TIER_ALIASES[n] || n; return TIER_CONFIG[c] ? c : 'free'; }
function tierRank(rawTier) { return TIER_CONFIG[normalizeTier(rawTier)]?.rank ?? 0; }
function clampStat(value, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }
function dedupeById(rows) { const out = []; const seen = new Set(); for (const row of rows || []) { const id = String(row?.id || ''); if (!id || seen.has(id)) continue; seen.add(id); out.push(row); } return out; }
async function tryFilterMany(ea, filters) { const rows = []; for (const f of filters) { try { const res = await ea.filter(f); if (Array.isArray(res)) rows.push(...res); } catch {} } return dedupeById(rows); }
function extractEntityOwner(entity) { if (!entity) return null; for (const key of SCHEMA_ASSUMPTIONS.ownerFields) { if (typeof entity[key] === 'string' && entity[key].trim()) return entity[key].trim(); } return null; }
function ownerMatches(owner, ownerKeys) { return owner ? ownerKeys.includes(owner) : false; }
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

// Identity computation
function normalizeAffinityValue(v) { const n = Number(v); return Number.isFinite(n) ? clampStat(Math.round(n), 0, 100) : 0; }
function normalizeAffinity(a) { return { aggressive: normalizeAffinityValue(a?.aggressive), nurturing: normalizeAffinityValue(a?.nurturing), curious: normalizeAffinityValue(a?.curious), chaotic: normalizeAffinityValue(a?.chaotic), disciplined: normalizeAffinityValue(a?.disciplined) }; }
function deriveCompanionIdentity(affinityInput) {
  const a = normalizeAffinity(affinityInput);
  const tScores = { Fierce: a.aggressive*2+a.chaotic, Protective: a.nurturing*2+a.disciplined, Calculating: a.disciplined*2+a.curious, Playful: a.chaotic*2+a.curious, Calm: a.disciplined*2+a.nurturing, Unstable: a.chaotic*3 };
  const aScores = { Berserker: a.aggressive*3, Guardian: a.nurturing*2+a.disciplined, Oracle: a.curious*2+a.disciplined, Trickster: a.chaotic*2+a.curious, Caretaker: a.nurturing*3, Duelist: a.aggressive*2+a.disciplined, Vanguard: a.disciplined*2+a.aggressive, Adaptive: 5 };
  let temperament = 'Calm', tS = -Infinity; for (const [k, s] of Object.entries(tScores)) { if (s > tS) { temperament = k; tS = s; } }
  let buildArchetype = 'Adaptive', aS = -Infinity; for (const [k, s] of Object.entries(aScores)) { if (s > aS) { buildArchetype = k; aS = s; } }
  return { trait_affinity: a, temperament, build_archetype: buildArchetype };
}
const EP_BF = { Guardian: 'Bulwark', Predator: 'Athletic', Mystic: 'Ethereal', Scholar: 'Balanced', Trickster: 'Agile', Adaptive: 'Balanced' };
const AB_BF = { Berserker: 'Athletic', Guardian: 'Bulwark', Oracle: 'Ethereal', Trickster: 'Agile', Caretaker: 'Balanced', Duelist: 'Athletic', Vanguard: 'Bulwark', Adaptive: 'Balanced' };
function recomputeCompanionIdentity(comp, options = {}) {
  const c = comp || {}; const identity = deriveCompanionIdentity(c.trait_affinity);
  const bondLevel = clampStat(Number(c.bond_level || 0), 0, 100);
  let bf = null; const ep = String(c.evolution_path || '').trim(); if (ep && EP_BF[ep]) bf = EP_BF[ep];
  if (!bf && identity.build_archetype && AB_BF[identity.build_archetype]) bf = AB_BF[identity.build_archetype];
  if (!bf) bf = c.body_frame;
  return { trait_affinity: identity.trait_affinity, temperament: identity.temperament, build_archetype: identity.build_archetype, body_frame: String(bf || 'Balanced'), bond_level: bondLevel };
}

// ── Handler ──
const STARTING_STAGE_STATS = { infant: { knowledge_level: 5, personality_openness: 30 }, child: { knowledge_level: 30, personality_openness: 50 }, teenager: { knowledge_level: 60, personality_openness: 70 } };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const name = String(payload?.name || '').trim();
    const stage = (() => { const s = String(payload?.stage || 'child').trim().toLowerCase(); return STARTING_STAGE_STATS[s] ? s : 'child'; })();
    const species = String(payload?.species || 'celestial').trim().toLowerCase() || 'celestial';

    if (!name) return Response.json({ error: 'Companion name is required.' }, { status: 400 });
    if (name.length > 48) return Response.json({ error: 'Companion name must be 48 characters or fewer.' }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    const companions = await listOwnedRecords(base44, 'Companion', ownerKeys);
    const currentCount = companions.length;

    if (currentCount >= Number(entitlements.max_pupils_allowed || 2)) {
      return Response.json({ error: `Pupil limit reached for ${entitlements.tier} tier (${entitlements.max_pupils_allowed} max).`, code: 'PUPIL_LIMIT_REACHED', tier: entitlements.tier, max_pupils_allowed: entitlements.max_pupils_allowed, current_pupils: currentCount }, { status: 403 });
    }

    const stageStats = STARTING_STAGE_STATS[stage];
    const now = new Date().toISOString();
    const baseCompanion = {
      name, starting_stage: stage, stage, species, hunger: 70, happiness: 60, fitness: 50,
      knowledge_level: stageStats.knowledge_level, personality_openness: stageStats.personality_openness,
      personality_agreeableness: 50, personality_curiosity: 60, personality_energy: 50, personality_empathy: 40,
      body_form: 'round', body_size: 'small', primary_color: '#9b87f5', secondary_color: '#7dd3c0', accent_color: '#fbbf24',
      mood: 'curious', trust_level: 10, affection_level: 10, experience_points: 0, level: 1,
      special_abilities: [], learned_topics: [],
      trait_affinity: { aggressive: 0, nurturing: 0, curious: 0, chaotic: 0, disciplined: 0 },
      bond_level: 0, combat_damage_dealt: 0, combat_damage_blocked: 0, combat_healing_done: 0, combat_ally_saves: 0, combat_status_inflicted: 0,
      last_interaction: now
    };

    const identityPatch = recomputeCompanionIdentity(baseCompanion, { recomputedAt: now });
    const companion = await base44.entities.Companion.create({ ...baseCompanion, ...identityPatch });

    const nextCount = currentCount + 1;
    const currency = await getUserCurrencyRecord(base44, ownerKeys);
    if (currency?.id) {
      await base44.asServiceRole.entities.UserCurrency.update(currency.id, { max_pupils_allowed: entitlements.max_pupils_allowed, free_pupils_count: nextCount });
    } else {
      await base44.entities.UserCurrency.create({ pcp_balance: 0, free_pupils_count: nextCount, max_pupils_allowed: entitlements.max_pupils_allowed });
    }

    return Response.json({ success: true, companion, tier: entitlements.tier, max_pupils_allowed: entitlements.max_pupils_allowed, current_pupils: nextCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});