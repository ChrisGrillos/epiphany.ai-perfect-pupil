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
const ACTION_CONFIG = {
  feed: { stat_changes: { hunger: 15, happiness: 5, trust_level: 2 }, xp: 5, cooldown_field: 'last_fed', cooldown_minutes: 5, responses: ["{name} happily munches on the treat!", "Yummy! {name} loves it!", "{name}'s tummy is happy now!"] },
  exercise: { stat_changes: { fitness: 10, happiness: 8, personality_energy: 3 }, stat_costs: { hunger: 10 }, xp: 8, cooldown_field: 'last_exercised', cooldown_minutes: 10, responses: ["{name} bounces around energetically!", "What a workout! {name} is getting stronger!", "{name} loves playtime!"] },
  study: { stat_changes: { knowledge_level: 5, happiness: 3, personality_curiosity: 2 }, xp: 10, cooldown_field: 'last_interaction', cooldown_minutes: 5, responses: ["{name} learned something new today!", "{name}'s curiosity is growing!", "Knowledge is power! {name} is getting smarter!"] },
  interact: { stat_changes: { happiness: 10, trust_level: 5, affection_level: 3, personality_empathy: 2 }, xp: 6, cooldown_field: 'last_interaction', cooldown_minutes: 3, responses: ["{name} feels so loved!", "Your bond with {name} grows stronger!", "{name} appreciates the attention!"] },
  play: { stat_changes: { happiness: 12, fitness: 5, personality_energy: 4, personality_openness: 2 }, stat_costs: { hunger: 5 }, xp: 7, cooldown_field: 'last_interaction', cooldown_minutes: 5, responses: ["{name} is having so much fun!", "Playtime is the best time for {name}!", "{name} giggles with joy!"] }
};
const ACTION_REQUIRED_TIERS = { feed: 'basic', exercise: 'basic', study: 'basic', interact: 'basic', play: 'basic' };

function calculateMood(companion) {
  const avg = (companion.hunger + companion.happiness + companion.fitness) / 3;
  if (avg >= 80) return 'joyful'; if (avg >= 60) return 'content'; if (avg >= 40) return 'neutral';
  if (companion.hunger < 30) return 'tired'; if (companion.happiness < 30) return 'sad'; return 'neutral';
}
function calculateLevel(xp) { return Math.floor(Math.sqrt(xp / 10)) + 1; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { companion_id, action_type } = await req.json();
    if (!companion_id || !action_type) return Response.json({ error: 'Missing companion_id or action_type' }, { status: 400 });

    const config = ACTION_CONFIG[action_type];
    if (!config) return Response.json({ error: `Invalid action_type: ${action_type}` }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    const requiredTier = ACTION_REQUIRED_TIERS[action_type] || 'free';
    if (!isTierAtLeast(entitlements.tier, requiredTier)) return Response.json({ error: `This action requires the ${requiredTier} tier.` }, { status: 403 });

    const companion = await getOwnedRecordById(base44, 'Companion', String(companion_id), ownerKeys);
    if (!companion) return Response.json({ error: 'Companion not found or not owned by caller' }, { status: 404 });

    if (config.cooldown_field && companion[config.cooldown_field]) {
      const diffMinutes = (new Date() - new Date(companion[config.cooldown_field])) / 60000;
      if (diffMinutes < config.cooldown_minutes) {
        const remaining = Math.ceil(config.cooldown_minutes - diffMinutes);
        return Response.json({ error: `Action on cooldown. Try again in ${remaining} minute(s).`, cooldown_remaining: remaining }, { status: 429 });
      }
    }

    const appliedChanges = {};
    const now = new Date().toISOString();
    for (const [stat, delta] of Object.entries(config.stat_changes)) { appliedChanges[stat] = clampStat((companion[stat] || 0) + delta); }
    if (config.stat_costs) { for (const [stat, cost] of Object.entries(config.stat_costs)) { appliedChanges[stat] = clampStat((appliedChanges[stat] !== undefined ? appliedChanges[stat] : (companion[stat] || 0)) - cost); } }

    const newXP = (companion.experience_points || 0) + config.xp;
    appliedChanges.experience_points = newXP;
    appliedChanges.level = calculateLevel(newXP);
    appliedChanges.mood = calculateMood({ ...companion, ...appliedChanges });
    if (config.cooldown_field) appliedChanges[config.cooldown_field] = now;
    appliedChanges.last_interaction = now;
    appliedChanges.total_care_actions = (companion.total_care_actions || 0) + 1;

    const currentAffinity = companion.trait_affinity || { aggressive: 0, nurturing: 0, curious: 0, chaotic: 0, disciplined: 0 };
    const affinityDeltas = { feed: { nurturing: 2, disciplined: 1 }, exercise: { aggressive: 1, disciplined: 2 }, study: { curious: 3, disciplined: 1 }, interact: { nurturing: 2, curious: 1 }, play: { chaotic: 1, nurturing: 1 } };
    const deltas = affinityDeltas[action_type] || {};
    const newAffinity = { ...currentAffinity };
    for (const [trait, delta] of Object.entries(deltas)) { newAffinity[trait] = (newAffinity[trait] || 0) + delta; }
    appliedChanges.trait_affinity = newAffinity;
    appliedChanges.bond_level = Math.min(100, (companion.bond_level || 0) + 1);

    Object.assign(appliedChanges, recomputeCompanionIdentity({ ...companion, ...appliedChanges }));

    const responseText = config.responses[Math.floor(Math.random() * config.responses.length)].replace('{name}', companion.name);
    await base44.asServiceRole.entities.Companion.update(companion_id, appliedChanges);
    await base44.asServiceRole.entities.InteractionLog.create({ companion_id, action_type, stat_changes: appliedChanges, companion_response: responseText, xp_awarded: config.xp, source: 'care' });

    return Response.json({ companion: { ...companion, ...appliedChanges }, stat_changes: appliedChanges, response_text: responseText, xp_awarded: config.xp });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});