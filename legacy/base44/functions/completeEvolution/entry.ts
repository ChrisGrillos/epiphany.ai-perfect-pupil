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
function clampStat(value, min = 0, max = 100) { return Math.max(min, Math.min(max, value)); }
function dedupeById(rows) { const out = []; const seen = new Set(); for (const row of rows || []) { const id = String(row?.id || ''); if (!id || seen.has(id)) continue; seen.add(id); out.push(row); } return out; }
async function tryFilterMany(ea, filters) { const rows = []; for (const f of filters) { try { const res = await ea.filter(f); if (Array.isArray(res)) rows.push(...res); } catch {} } return dedupeById(rows); }
function extractEntityOwner(entity) { if (!entity) return null; for (const key of SCHEMA_ASSUMPTIONS.ownerFields) { if (typeof entity[key] === 'string' && entity[key].trim()) return entity[key].trim(); } return null; }
function ownerMatches(owner, ownerKeys) { return owner ? ownerKeys.includes(owner) : false; }
async function getOwnedRecordById(base44, entityName, id, ownerKeys) {
  const svc = base44?.asServiceRole?.entities?.[entityName]; const usr = base44?.entities?.[entityName];
  if (svc?.filter) { try { const rows = await svc.filter({ id }); const row = Array.isArray(rows) ? rows[0] : null; if (!row) return null; const owner = extractEntityOwner(row); if (!owner) { if (usr?.filter) { const sr = await usr.filter({ id }); return Array.isArray(sr) && sr.length > 0 ? row : null; } return null; } return ownerMatches(owner, ownerKeys) ? row : null; } catch {} }
  if (usr?.filter) { try { const rows = await usr.filter({ id }); return Array.isArray(rows) && rows.length > 0 ? rows[0] : null; } catch {} }
  return null;
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
  const sub = ranked.find(r => r?.is_active !== false) || ranked[0] || null;
  const tier = normalizeTier(sub?.tier || 'free'); const config = TIER_CONFIG[tier] || TIER_CONFIG.free;
  return { tier, is_paid: config.isPaid, max_pupils_allowed: config.maxPupils, monthly_ai_call_limit: config.monthlyAiCalls, subscription: sub };
}
function normalizeAffinityValue(v) { const n = Number(v); return Number.isFinite(n) ? clampStat(Math.round(n), 0, 100) : 0; }
function normalizeAffinity(a) { return { aggressive: normalizeAffinityValue(a?.aggressive), nurturing: normalizeAffinityValue(a?.nurturing), curious: normalizeAffinityValue(a?.curious), chaotic: normalizeAffinityValue(a?.chaotic), disciplined: normalizeAffinityValue(a?.disciplined) }; }
function deriveCompanionIdentity(affinityInput) {
  const a = normalizeAffinity(affinityInput);
  const tS = { Fierce: a.aggressive*2+a.chaotic, Protective: a.nurturing*2+a.disciplined, Calculating: a.disciplined*2+a.curious, Playful: a.chaotic*2+a.curious, Calm: a.disciplined*2+a.nurturing, Unstable: a.chaotic*3 };
  const aS = { Berserker: a.aggressive*3, Guardian: a.nurturing*2+a.disciplined, Oracle: a.curious*2+a.disciplined, Trickster: a.chaotic*2+a.curious, Caretaker: a.nurturing*3, Duelist: a.aggressive*2+a.disciplined, Vanguard: a.disciplined*2+a.aggressive, Adaptive: 5 };
  let temperament = 'Calm', ts = -Infinity; for (const [k, s] of Object.entries(tS)) { if (s > ts) { temperament = k; ts = s; } }
  let buildArchetype = 'Adaptive', as2 = -Infinity; for (const [k, s] of Object.entries(aS)) { if (s > as2) { buildArchetype = k; as2 = s; } }
  return { trait_affinity: a, temperament, build_archetype: buildArchetype };
}
const EP_BF = { Guardian: 'Bulwark', Predator: 'Athletic', Mystic: 'Ethereal', Scholar: 'Balanced', Trickster: 'Agile', Adaptive: 'Balanced' };
const AB_BF = { Berserker: 'Athletic', Guardian: 'Bulwark', Oracle: 'Ethereal', Trickster: 'Agile', Caretaker: 'Balanced', Duelist: 'Athletic', Vanguard: 'Bulwark', Adaptive: 'Balanced' };
function recomputeCompanionIdentity(comp) {
  const c = comp || {}; const identity = deriveCompanionIdentity(c.trait_affinity);
  const bondLevel = clampStat(Number(c.bond_level || 0), 0, 100);
  let bf = null; const ep = String(c.evolution_path || '').trim(); if (ep && EP_BF[ep]) bf = EP_BF[ep];
  if (!bf && identity.build_archetype && AB_BF[identity.build_archetype]) bf = AB_BF[identity.build_archetype];
  if (!bf) bf = c.body_frame;
  return { trait_affinity: identity.trait_affinity, temperament: identity.temperament, build_archetype: identity.build_archetype, body_frame: String(bf || 'Balanced'), bond_level: bondLevel };
}

// ── Handler ──
const EVOLUTION_PATH = ['infant', 'child', 'teenager', 'adult'];
const STAGE_XP_REQUIREMENTS = { infant: 0, child: 100, teenager: 500, adult: 2000 };
const EVOLUTION_STAT_BONUSES = { child: { knowledge_level: 5, personality_curiosity: 5, happiness: 10 }, teenager: { knowledge_level: 10, fitness: 5, personality_openness: 5, personality_energy: 5 }, adult: { knowledge_level: 15, fitness: 10, personality_empathy: 10, trust_level: 10 } };
const PCP_REWARDS = { child: 10, teenager: 25, adult: 50 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { companion_id, puzzle_id } = await req.json();
    if (!companion_id) return Response.json({ error: 'Missing companion_id' }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, 'premium')) return Response.json({ error: `Guided evolution requires Premium or Elite. Your current tier is ${entitlements.tier}.` }, { status: 403 });

    const companion = await getOwnedRecordById(base44, 'Companion', String(companion_id), ownerKeys);
    if (!companion) return Response.json({ error: 'Companion not found or not owned by caller' }, { status: 404 });

    const currentIndex = EVOLUTION_PATH.indexOf(companion.stage);
    if (currentIndex === -1 || currentIndex >= EVOLUTION_PATH.length - 1) return Response.json({ error: 'Companion is already at maximum stage' }, { status: 400 });

    const nextStage = EVOLUTION_PATH[currentIndex + 1];
    const requiredXP = STAGE_XP_REQUIREMENTS[nextStage];

    if ((companion.experience_points || 0) < requiredXP) {
      await base44.asServiceRole.entities.EvolutionAttempt.create({ companion_id, puzzle_id: puzzle_id || null, from_stage: companion.stage, to_stage: nextStage, success: false, failure_reason: `Insufficient XP. Need ${requiredXP}, have ${companion.experience_points || 0}.`, xp_cost: 0, pcp_reward: 0 });
      return Response.json({ success: false, from_stage: companion.stage, to_stage: nextStage, reason: `Need ${requiredXP} XP to evolve. Current: ${companion.experience_points || 0}.` });
    }

    if (puzzle_id) {
      const puzzles = await base44.asServiceRole.entities.EvolutionPuzzle.filter({ id: puzzle_id });
      if (puzzles && puzzles.length > 0 && !puzzles[0].completed) return Response.json({ success: false, reason: 'Puzzle must be completed before evolution.' });
    }

    const statBonuses = EVOLUTION_STAT_BONUSES[nextStage] || {};
    const statChanges = {};
    for (const [stat, bonus] of Object.entries(statBonuses)) { statChanges[stat] = clampStat((companion[stat] || 0) + bonus); }
    statChanges.stage = nextStage;

    const currentAffinity = companion.trait_affinity || { aggressive: 0, nurturing: 0, curious: 0, chaotic: 0, disciplined: 0 };
    const newAffinity = { ...currentAffinity, disciplined: (currentAffinity.disciplined || 0) + 5, curious: (currentAffinity.curious || 0) + 3 };
    statChanges.trait_affinity = newAffinity;
    statChanges.bond_level = Math.min(100, (companion.bond_level || 0) + 10);

    if (nextStage === 'adult' && companion.evolution_path) {
      const pathBonuses = { Guardian: { fitness: 15, personality_empathy: 10 }, Predator: { fitness: 10, personality_energy: 15 }, Mystic: { knowledge_level: 15, personality_curiosity: 10 }, Scholar: { knowledge_level: 10, personality_empathy: 15 }, Trickster: { personality_openness: 15, personality_energy: 10 }, Adaptive: { knowledge_level: 5, fitness: 5, personality_openness: 5 } };
      const bonus = pathBonuses[companion.evolution_path] || {};
      for (const [stat, val] of Object.entries(bonus)) { statChanges[stat] = clampStat((statChanges[stat] || companion[stat] || 0) + val); }
    }

    Object.assign(statChanges, recomputeCompanionIdentity({ ...companion, ...statChanges }));
    const pcpReward = PCP_REWARDS[nextStage] || 0;

    await base44.asServiceRole.entities.Companion.update(companion_id, statChanges);

    if (pcpReward > 0) {
      const currency = await getUserCurrencyRecord(base44, ownerKeys);
      if (currency) { await base44.asServiceRole.entities.UserCurrency.update(currency.id, { pcp_balance: (currency.pcp_balance || 0) + pcpReward, pcp_earned: (currency.pcp_earned || 0) + pcpReward }); }
    }

    await base44.asServiceRole.entities.EvolutionAttempt.create({ companion_id, puzzle_id: puzzle_id || null, from_stage: companion.stage, to_stage: nextStage, success: true, stat_changes: statChanges, xp_cost: 0, pcp_reward: pcpReward });
    await base44.asServiceRole.entities.InteractionLog.create({ companion_id, action_type: 'puzzle', details: { from_stage: companion.stage, to_stage: nextStage }, stat_changes: statChanges, companion_response: `${companion.name} evolved to ${nextStage}!`, xp_awarded: 0, pcp_awarded: pcpReward, source: 'evolution' });

    return Response.json({ success: true, from_stage: companion.stage, to_stage: nextStage, stat_changes: statChanges, pcp_reward: pcpReward, companion: { ...companion, ...statChanges } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});