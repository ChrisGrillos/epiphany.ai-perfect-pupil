import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities ──
const SCHEMA_ASSUMPTIONS = Object.freeze({ ownerFields: ['created_by', 'owner_id', 'user_id'], traitAffinityMin: 0, traitAffinityMax: 100 });
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
function recomputeCompanionIdentity(comp, options = {}) {
  const c = comp || {}; const identity = deriveCompanionIdentity(c.trait_affinity);
  const bondLevel = clampStat(Number(c.bond_level || 0), 0, 100);
  let bf = null; const ep = String(c.evolution_path || '').trim(); if (ep && EP_BF[ep]) bf = EP_BF[ep];
  if (!bf && identity.build_archetype && AB_BF[identity.build_archetype]) bf = AB_BF[identity.build_archetype];
  if (!bf) bf = c.body_frame;
  return { trait_affinity: identity.trait_affinity, temperament: identity.temperament, build_archetype: identity.build_archetype, body_frame: String(bf || 'Balanced'), bond_level: bondLevel };
}

// ── Handler ──
const EVOLUTION_PATHS = {
  Guardian: { requiredTraits: { nurturing: 10, disciplined: 8 }, signatureAbility: 'Unbreakable Vow: Absorb all damage targeted at allies for 2 turns', subtypes: { Aegis: 'Iron Wall: Reduce all incoming damage by 15%', Sentinel: 'Vigilant Eye: Auto-counter when an ally takes critical damage', Bastion: 'Living Fortress: Regenerate 5% HP per turn' } },
  Predator: { requiredTraits: { aggressive: 10, disciplined: 5 }, signatureAbility: 'Apex Strike: Deal 300% power damage, ignoring all defenses', subtypes: { Blade: 'Razor Instinct: +25% critical hit chance', Ravager: 'Armor Break: Attacks reduce target guard by 10%', Hunter: 'Predator Sense: +30% damage to enemies below 40% HP' } },
  Mystic: { requiredTraits: { curious: 10, disciplined: 5 }, signatureAbility: 'Arcane Tempest: Hit all enemies with their elemental weakness', subtypes: { Elementalist: 'Elemental Resonance: Elemental moves deal 20% bonus damage', Enchanter: 'Aura Weaver: All buffs last 1 extra turn', Seer: 'Foresight: 20% chance to dodge any attack' } },
  Scholar: { requiredTraits: { curious: 8, nurturing: 8 }, signatureAbility: 'Grand Strategy: Reset all ally cooldowns and heal 30% HP', subtypes: { Medic: 'Triage: Healing moves are 25% more effective', Tactician: 'Battle Mind: Team gains +10% speed', Sage: 'Wisdom: Knowledge level adds to all stat calculations' } },
  Trickster: { requiredTraits: { chaotic: 10, curious: 5 }, signatureAbility: 'Chaos Cascade: Apply 3 random status effects to all enemies', subtypes: { Phantom: 'Shadow Step: +30% evasion rate', Jester: 'Wild Card: Each turn, gain a random powerful buff', Saboteur: 'Disruption: 20% chance to jam enemy moves' } },
  Adaptive: { requiredTraits: {}, signatureAbility: "Adaptation: Copy the strongest enemy unit's highest stat for 3 turns", subtypes: { Hybrid: 'Versatile: +10% to all stats', Mimic: 'Mirror: Can use the last move used against you', Catalyst: 'Synergy: Team composition bonuses are doubled' } }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const companionId = String(payload?.companion_id || '').trim();
    const evolutionPath = String(payload?.evolution_path || '').trim();
    const subtype = String(payload?.subtype || '').trim();
    if (!companionId || !evolutionPath || !subtype) return Response.json({ error: 'Missing companion_id, evolution_path, or subtype.' }, { status: 400 });

    const pathConfig = EVOLUTION_PATHS[evolutionPath];
    if (!pathConfig) return Response.json({ error: `Unsupported evolution path: ${evolutionPath}` }, { status: 400 });
    const signaturePassive = pathConfig.subtypes[subtype];
    if (!signaturePassive) return Response.json({ error: `Subtype ${subtype} is not valid for ${evolutionPath}.` }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, 'premium')) return Response.json({ error: `Evolution path control requires Premium or Elite. Your current tier is ${entitlements.tier}.` }, { status: 403 });

    const companion = await getOwnedRecordById(base44, 'Companion', companionId, ownerKeys);
    if (!companion) return Response.json({ error: 'Companion not found or not owned by caller.' }, { status: 404 });
    if (String(companion.stage || '') !== 'teenager') return Response.json({ error: 'Evolution path can only be selected at the teenager stage.' }, { status: 409 });
    if (companion.evolution_path) return Response.json({ error: 'Evolution path has already been selected for this companion.' }, { status: 409 });

    const affinity = companion?.trait_affinity || {};
    for (const [trait, minimum] of Object.entries(pathConfig.requiredTraits)) {
      if (Number(affinity?.[trait] || 0) < Number(minimum || 0)) return Response.json({ error: 'Trait affinity requirements are not met for this evolution path.' }, { status: 403 });
    }

    const updatePayload = { evolution_path: evolutionPath, subtype, signature_passive: signaturePassive, signature_ability: pathConfig.signatureAbility };
    Object.assign(updatePayload, recomputeCompanionIdentity({ ...companion, ...updatePayload }, { recomputedAt: new Date().toISOString() }));

    await base44.asServiceRole.entities.Companion.update(companionId, updatePayload);
    return Response.json({ success: true, companion: { ...companion, ...updatePayload } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});