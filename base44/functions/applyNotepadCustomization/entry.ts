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

// ── Handler ──
const CUSTOMIZATION_LIMITS = { free: { traits: 0, memories: 0, rules: 0 }, basic: { traits: 3, memories: 5, rules: 2 }, premium: { traits: 10, memories: 20, rules: 10 }, elite: { traits: 999, memories: 999, rules: 999 } };
const TRAIT_FIELD_MAP = { wit: 'personality_openness', witty: 'personality_openness', calm: 'personality_agreeableness', patient: 'personality_agreeableness', curious: 'personality_curiosity', energetic: 'personality_energy', empathetic: 'personality_empathy', supportive: 'personality_empathy' };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const companionId = String(payload?.companion_id || '').trim();
    const content = String(payload?.content || '').trim();
    if (!companionId || !content) return Response.json({ error: 'Missing companion_id or content.' }, { status: 400 });
    if (content.length > 12000) return Response.json({ error: 'Customization text is too long.' }, { status: 413 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, 'basic')) return Response.json({ error: `Natural language customization requires Basic or above.` }, { status: 403 });

    const companion = await getOwnedRecordById(base44, 'Companion', companionId, ownerKeys);
    if (!companion) return Response.json({ error: 'Companion not found or not owned by caller.' }, { status: 404 });

    const limits = CUSTOMIZATION_LIMITS[entitlements.tier] || CUSTOMIZATION_LIMITS.free;
    const [existingMemories, existingRules] = await Promise.all([
      base44.asServiceRole.entities.CompanionMemory.filter({ companion_id: companionId }),
      base44.asServiceRole.entities.BehaviorRule.filter({ companion_id: companionId })
    ]);

    const parseResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a behavior parser for an AI companion. Extract structured customization data from the following natural language input.\n\nInput: "${content}"\n\nExtract: 1. Personality traits ({name, value 0-100}), 2. Memories ({key, value}), 3. Behavior rules ({name, description, condition, action}).`,
      response_json_schema: { type: 'object', properties: { traits: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'number' } } } }, memories: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, type: { type: 'string', enum: ['fact', 'preference', 'event', 'emotion', 'skill'] } } } }, rules: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, condition: { type: 'string' }, action: { type: 'string' }, priority: { type: 'number' } } } } } }
    });

    const parsedTraits = Array.isArray(parseResult?.traits) ? parseResult.traits : [];
    const parsedMemories = Array.isArray(parseResult?.memories) ? parseResult.memories : [];
    const parsedRules = Array.isArray(parseResult?.rules) ? parseResult.rules : [];

    if (existingMemories.length + parsedMemories.length > limits.memories) return Response.json({ error: `Memory limit (${limits.memories}) would be exceeded.` }, { status: 403 });
    if (existingRules.length + parsedRules.length > limits.rules) return Response.json({ error: `Behavior rule limit (${limits.rules}) would be exceeded.` }, { status: 403 });

    const traitsToApply = parsedTraits.slice(0, limits.traits);
    const createdMemories = []; const createdRules = [];

    for (const memory of parsedMemories) {
      if (!memory?.key || !memory?.value) continue;
      const created = await base44.asServiceRole.entities.CompanionMemory.create({ companion_id: companionId, memory_key: String(memory.key).trim(), memory_value: String(memory.value).trim(), memory_type: memory.type || 'fact', importance: 70, source: 'notepad', is_encrypted: true, tags: [] });
      createdMemories.push(created);
    }
    for (const rule of parsedRules) {
      if (!rule?.name) continue;
      const created = await base44.asServiceRole.entities.BehaviorRule.create({ companion_id: companionId, rule_name: String(rule.name).trim(), rule_description: rule.description || '', condition: rule.condition || '', action: rule.action || '', priority: Number(rule.priority || 50), is_active: true, parsed_metadata: rule });
      createdRules.push(created);
    }

    const traitUpdates = {};
    for (const trait of traitsToApply) { const key = String(trait?.name || '').trim().toLowerCase(); const field = TRAIT_FIELD_MAP[key]; if (field) traitUpdates[field] = clampStat(Number(trait?.value || 0), 0, 100); }
    if (Object.keys(traitUpdates).length > 0) await base44.asServiceRole.entities.Companion.update(companionId, traitUpdates);

    return Response.json({ success: true, parsed: { traits: traitsToApply, memories: parsedMemories, rules: parsedRules }, applied: { memories_created: createdMemories.length, rules_created: createdRules.length, traits_applied: Object.keys(traitUpdates).length }, limits });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});