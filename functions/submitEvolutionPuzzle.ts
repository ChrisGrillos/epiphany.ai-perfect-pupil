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

// ── Handler ──
const DIFFICULTY_XP_MULTIPLIER = { easy: 1, medium: 2, hard: 3, expert: 4 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const companionId = String(payload?.companion_id || '').trim();
    const difficulty = (() => { const d = String(payload?.difficulty || 'easy').trim().toLowerCase(); return DIFFICULTY_XP_MULTIPLIER[d] ? d : 'easy'; })();
    const evolutionDna = payload?.evolution_dna ?? payload?.result ?? null;

    if (!companionId) return Response.json({ error: 'Missing companion_id.' }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, 'premium')) return Response.json({ error: `Evolution puzzle is available on Premium or Elite. Your current tier is ${entitlements.tier}.` }, { status: 403 });

    const companion = await getOwnedRecordById(base44, 'Companion', companionId, ownerKeys);
    if (!companion) return Response.json({ error: 'Companion not found or not owned by caller.' }, { status: 404 });

    const xpGain = 50 * DIFFICULTY_XP_MULTIPLIER[difficulty];
    const bonuses = { personality_openness: Math.floor(Math.random() * 3) + 1, personality_curiosity: Math.floor(Math.random() * 3) + 1 };
    const updatePayload = { ...bonuses, experience_points: Number(companion.experience_points || 0) + xpGain, evolution_dna: evolutionDna };

    await base44.asServiceRole.entities.Companion.update(companionId, updatePayload);
    const puzzle = await base44.asServiceRole.entities.EvolutionPuzzle.create({ companion_id: companionId, puzzle_type: 'full_helix', completed: true, completion_reward: { ...bonuses, xp_gain: xpGain }, difficulty });

    return Response.json({ success: true, companion: { ...companion, ...updatePayload }, bonuses: { ...bonuses, xp_gain: xpGain }, puzzle });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});