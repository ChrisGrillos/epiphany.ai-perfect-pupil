import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Inlined shared utilities ──
const SCHEMA_ASSUMPTIONS = Object.freeze({ ownerFields: ['created_by', 'owner_id', 'user_id'], maxEncryptedImportBytes: 10 * 1024 * 1024 });
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

// ── Crypto utilities ──
function b64Decode(str) { const bin = atob(str); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return bytes; }
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}
async function decryptJsonPayload(pkg, passphrase) {
  const salt = b64Decode(pkg.salt_b64); const iv = b64Decode(pkg.iv_b64); const ciphertext = b64Decode(pkg.ciphertext_b64);
  const key = await deriveKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
function estimateJsonBytes(obj) { return new TextEncoder().encode(JSON.stringify(obj)).length; }

// ── Handler ──
const BRAIN_IMPORT_RULES = Object.freeze({ maxMemories: 2000, maxRules: 500, maxChatSessions: 250, maxChatMessagesPerSession: 500, maxEvolutionHistory: 1000, maxTagsPerMemory: 32, maxSpecialAbilities: 256, maxLearnedTopics: 512, maxString: 2048, maxLongText: 12000 });
const STAGE_ALLOWLIST = new Set(['infant', 'child', 'teenager', 'adult']);
const MEMORY_TYPE_ALLOWLIST = new Set(['fact', 'preference', 'event', 'emotion', 'skill']);
const CHAT_ROLE_ALLOWLIST = new Set(['user', 'companion', 'system']);
const CHAT_EMOTION_ALLOWLIST = new Set(['happy', 'curious', 'thoughtful', 'excited', 'calm', 'sad', 'frustrated', 'neutral', '']);
const RESPONSE_MODE_ALLOWLIST = new Set(['ai_assisted', 'default', 'fallback']);
const COMPANION_IMPORT_FIELDS = ['build_archetype', 'body_frame', 'temperament', 'trait_affinity', 'bond_level', 'evolution_path', 'subtype', 'signature_passive', 'signature_ability', 'personality_openness', 'personality_agreeableness', 'personality_curiosity', 'personality_energy', 'personality_empathy', 'special_abilities', 'learned_topics'];
const IDENTITY_TRIGGER_FIELDS = new Set(['build_archetype', 'body_frame', 'temperament', 'trait_affinity', 'bond_level', 'evolution_path', 'subtype']);

function isPlainObject(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function safeString(v, maxLength = BRAIN_IMPORT_RULES.maxString) { if (v === null || v === undefined) return ''; return String(v).slice(0, maxLength); }
function safeNumber(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function normalizeEnum(v, allowlist, fallback = '') { const c = safeString(v, 64).toLowerCase(); return allowlist.has(c) ? c : fallback; }
function isLikelyLegacyV1Package(bp) { if (!isPlainObject(bp)) return false; return (isPlainObject(bp.companion) || Array.isArray(bp.memories) || Array.isArray(bp.behavior_rules)) && typeof bp.ciphertext_b64 !== 'string'; }
function isValidEncryptedPackage(bp) { if (!isPlainObject(bp)) return false; return Boolean(typeof bp.salt_b64 === 'string' && typeof bp.iv_b64 === 'string' && typeof bp.ciphertext_b64 === 'string' && isPlainObject(bp.encryption)); }

function sanitizeTraitAffinity(raw) { const a = isPlainObject(raw) ? raw : {}; return { aggressive: clampStat(Math.round(safeNumber(a.aggressive, 0)), 0, 100), nurturing: clampStat(Math.round(safeNumber(a.nurturing, 0)), 0, 100), curious: clampStat(Math.round(safeNumber(a.curious, 0)), 0, 100), chaotic: clampStat(Math.round(safeNumber(a.chaotic, 0)), 0, 100), disciplined: clampStat(Math.round(safeNumber(a.disciplined, 0)), 0, 100) }; }
function sanitizeCompanionUpdate(cd) {
  const sc = isPlainObject(cd) ? cd : {}; const update = {};
  for (const field of COMPANION_IMPORT_FIELDS) {
    if (sc[field] === undefined || sc[field] === null) continue;
    if (field === 'trait_affinity') { update.trait_affinity = sanitizeTraitAffinity(sc.trait_affinity); continue; }
    if (field === 'bond_level') { update.bond_level = clampStat(Math.round(safeNumber(sc.bond_level, 0)), 0, 100); continue; }
    if (field.startsWith('personality_')) { update[field] = clampStat(Math.round(safeNumber(sc[field], 0)), 0, 100); continue; }
    if (field === 'special_abilities') { if (!Array.isArray(sc.special_abilities)) continue; update.special_abilities = sc.special_abilities.slice(0, BRAIN_IMPORT_RULES.maxSpecialAbilities).map(i => safeString(i, 160)).filter(Boolean); continue; }
    if (field === 'learned_topics') { if (!Array.isArray(sc.learned_topics)) continue; update.learned_topics = sc.learned_topics.slice(0, BRAIN_IMPORT_RULES.maxLearnedTopics).map(i => safeString(i, 160)).filter(Boolean); continue; }
    update[field] = safeString(sc[field], field.includes('signature') ? 400 : 160);
  }
  return update;
}
function sanitizeMemories(raw) { if (!Array.isArray(raw)) return []; if (raw.length > BRAIN_IMPORT_RULES.maxMemories) throw new Error(`Memory count exceeds limit.`); return raw.filter(m => isPlainObject(m) && safeString(m.memory_key, 128) && safeString(m.memory_value, BRAIN_IMPORT_RULES.maxLongText)).map(m => ({ memory_key: safeString(m.memory_key, 128), memory_value: safeString(m.memory_value, BRAIN_IMPORT_RULES.maxLongText), memory_type: normalizeEnum(m.memory_type, MEMORY_TYPE_ALLOWLIST, 'fact'), importance: clampStat(Math.round(safeNumber(m.importance, 50)), 0, 100), source: safeString(m.source || 'import', 64), tags: Array.isArray(m.tags) ? m.tags.slice(0, BRAIN_IMPORT_RULES.maxTagsPerMemory).map(t => safeString(t, 64)).filter(Boolean) : [] })); }
function sanitizeBehaviorRules(raw) { if (!Array.isArray(raw)) return []; if (raw.length > BRAIN_IMPORT_RULES.maxRules) throw new Error(`Rule count exceeds limit.`); return raw.filter(r => isPlainObject(r) && safeString(r.rule_name, 160)).map(r => ({ rule_name: safeString(r.rule_name, 160), rule_description: safeString(r.rule_description, 2000), condition: safeString(r.condition, 1000), action: safeString(r.action, 1000), priority: clampStat(Math.round(safeNumber(r.priority, 50)), 0, 100), personality_modifiers: isPlainObject(r.personality_modifiers) ? r.personality_modifiers : {} })); }
function sanitizeChatSessions(rawSessions, rawLegacyMessages) {
  const sessions = Array.isArray(rawSessions) ? rawSessions : [];
  if (sessions.length > BRAIN_IMPORT_RULES.maxChatSessions) throw new Error(`Chat session count exceeds limit.`);
  const out = [];
  for (const session of sessions) {
    if (!isPlainObject(session)) continue;
    const rawMessages = Array.isArray(session.messages) ? session.messages : [];
    if (rawMessages.length > BRAIN_IMPORT_RULES.maxChatMessagesPerSession) throw new Error(`A chat session exceeds message limit.`);
    const messages = rawMessages.map(msg => { if (!isPlainObject(msg)) return null; const role = normalizeEnum(msg.role, CHAT_ROLE_ALLOWLIST, ''); const content = safeString(msg.content, BRAIN_IMPORT_RULES.maxLongText); if (!role || !content) return null; return { role, content, emotion_tag: normalizeEnum(msg.emotion_tag, CHAT_EMOTION_ALLOWLIST, 'neutral') }; }).filter(Boolean);
    out.push({ title: safeString(session.title, 160), mood_at_start: safeString(session.mood_at_start, 64), mood_at_end: safeString(session.mood_at_end, 64), trust_delta: safeNumber(session.trust_delta, 0), messages });
  }
  const hasAnyMessages = out.some(s => Array.isArray(s.messages) && s.messages.length > 0);
  if (!hasAnyMessages && Array.isArray(rawLegacyMessages) && rawLegacyMessages.length > 0) {
    const migratedMessages = rawLegacyMessages.map(msg => { if (!isPlainObject(msg)) return null; const role = normalizeEnum(msg.role, CHAT_ROLE_ALLOWLIST, ''); const content = safeString(msg.content, BRAIN_IMPORT_RULES.maxLongText); if (!role || !content) return null; return { role, content, emotion_tag: normalizeEnum(msg.emotion_tag, CHAT_EMOTION_ALLOWLIST, 'neutral') }; }).filter(Boolean);
    if (out.length > 0) out[0].messages = migratedMessages; else out.push({ title: 'Imported Session (Legacy)', mood_at_start: '', mood_at_end: '', trust_delta: 0, messages: migratedMessages });
  }
  return out;
}
function sanitizeEvolutionHistory(raw) { if (!Array.isArray(raw)) return []; if (raw.length > BRAIN_IMPORT_RULES.maxEvolutionHistory) throw new Error(`Evolution history count exceeds limit.`); return raw.filter(e => isPlainObject(e)).map(e => ({ from_stage: normalizeEnum(e.from_stage, STAGE_ALLOWLIST, '') || null, to_stage: normalizeEnum(e.to_stage, STAGE_ALLOWLIST, '') || null, success: Boolean(e.success), stat_changes: isPlainObject(e.stat_changes) ? e.stat_changes : {}, failure_reason: safeString(e.failure_reason, 512) })).filter(e => e.from_stage || e.to_stage); }
function sanitizeAlgorithmState(raw) { if (!isPlainObject(raw)) return null; return { current_state: safeString(raw.current_state, 64) || 'content', behavioral_flags: isPlainObject(raw.behavioral_flags) ? raw.behavioral_flags : {}, transition_probabilities: isPlainObject(raw.transition_probabilities) ? raw.transition_probabilities : {}, response_mode: normalizeEnum(raw.response_mode, RESPONSE_MODE_ALLOWLIST, 'ai_assisted') }; }
function validateDecryptedBrainData(raw) {
  if (!isPlainObject(raw)) throw new Error('Decrypted payload is invalid.');
  const ev = safeString(raw.export_version, 16); if (ev && !ev.startsWith('2.')) throw new Error(`Unsupported brain payload version: ${ev}`);
  return { export_version: ev || '2.0.0', companion_update: sanitizeCompanionUpdate(raw.companion || {}), memories: sanitizeMemories(raw.memories), behavior_rules: sanitizeBehaviorRules(raw.behavior_rules), chat_sessions: sanitizeChatSessions(raw.chat_sessions, raw.chat_messages), evolution_history: sanitizeEvolutionHistory(raw.evolution_history), algorithm_state: sanitizeAlgorithmState(raw.algorithm_state) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { companion_id, brain_package, passphrase } = await req.json();
    if (!companion_id || !brain_package) return Response.json({ error: 'Missing companion_id or brain_package' }, { status: 400 });
    if (typeof passphrase !== 'string' || passphrase.length < 8) return Response.json({ error: 'A passphrase of at least 8 characters is required.' }, { status: 400 });

    const packageBytes = estimateJsonBytes(brain_package);
    if (packageBytes > SCHEMA_ASSUMPTIONS.maxEncryptedImportBytes) return Response.json({ error: 'Encrypted package is too large.' }, { status: 413 });
    if (isLikelyLegacyV1Package(brain_package)) return Response.json({ error: 'Legacy v1 exports are not supported. Re-export using v2 format.' }, { status: 400 });
    if (!isValidEncryptedPackage(brain_package)) return Response.json({ error: 'Invalid encrypted brain package format.' }, { status: 400 });

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!entitlements.is_paid) return Response.json({ error: `Brain import requires a paid subscription. Your tier is ${entitlements.tier}.` }, { status: 403 });

    const companionId = String(companion_id);
    const targetCompanion = await getOwnedRecordById(base44, 'Companion', companionId, ownerKeys);
    if (!targetCompanion) return Response.json({ error: 'Companion not found or not owned by caller' }, { status: 404 });

    let decryptedPayload;
    try { decryptedPayload = await decryptJsonPayload(brain_package, passphrase); } catch (error) { return Response.json({ error: error.message || 'Unable to decrypt brain package.' }, { status: 400 }); }

    let validated;
    try { validated = validateDecryptedBrainData(decryptedPayload); } catch (error) { return Response.json({ error: error.message || 'Brain payload validation failed.' }, { status: 400 }); }

    const companionUpdate = validated.companion_update || {};
    if (Object.keys(companionUpdate).some(f => IDENTITY_TRIGGER_FIELDS.has(f))) { Object.assign(companionUpdate, recomputeCompanionIdentity({ ...targetCompanion, ...companionUpdate })); }
    if (Object.keys(companionUpdate).length > 0) await base44.asServiceRole.entities.Companion.update(companionId, companionUpdate);

    const existingMemories = await base44.asServiceRole.entities.CompanionMemory.filter({ companion_id: companionId });
    const existingMemoryByKey = new Map((existingMemories || []).map(m => [m.memory_key, m]));
    for (const mem of validated.memories || []) {
      const payload = { companion_id: companionId, memory_key: mem.memory_key, memory_value: mem.memory_value, memory_type: mem.memory_type, importance: mem.importance, source: mem.source || 'import', tags: mem.tags, is_encrypted: true };
      const existing = existingMemoryByKey.get(mem.memory_key);
      if (existing) await base44.asServiceRole.entities.CompanionMemory.update(existing.id, payload);
      else { const created = await base44.asServiceRole.entities.CompanionMemory.create(payload); existingMemoryByKey.set(mem.memory_key, created); }
    }

    const existingRules = await base44.asServiceRole.entities.BehaviorRule.filter({ companion_id: companionId });
    const existingRuleByName = new Map((existingRules || []).map(r => [r.rule_name, r]));
    for (const rule of validated.behavior_rules || []) {
      const payload = { companion_id: companionId, rule_name: rule.rule_name, rule_description: rule.rule_description, condition: rule.condition, action: rule.action, priority: rule.priority, personality_modifiers: rule.personality_modifiers || {}, is_active: true };
      const existing = existingRuleByName.get(rule.rule_name);
      if (existing) await base44.asServiceRole.entities.BehaviorRule.update(existing.id, payload);
      else { const created = await base44.asServiceRole.entities.BehaviorRule.create(payload); existingRuleByName.set(rule.rule_name, created); }
    }

    for (const session of validated.chat_sessions || []) {
      const createdSession = await base44.asServiceRole.entities.ChatSession.create({ companion_id: companionId, title: session.title || 'Imported Session', message_count: session.messages.length, mood_at_start: session.mood_at_start || '', mood_at_end: session.mood_at_end || '', trust_delta: session.trust_delta || 0, last_message_at: new Date().toISOString() });
      for (const message of session.messages) await base44.asServiceRole.entities.ChatMessage.create({ session_id: createdSession.id, companion_id: companionId, role: message.role, content: message.content, emotion_tag: message.emotion_tag || 'neutral' });
    }

    for (const attempt of validated.evolution_history || []) await base44.asServiceRole.entities.EvolutionAttempt.create({ companion_id: companionId, puzzle_id: null, from_stage: attempt.from_stage, to_stage: attempt.to_stage, success: attempt.success, stat_changes: attempt.stat_changes, failure_reason: attempt.failure_reason || null, xp_cost: 0, pcp_reward: 0 });

    if (validated.algorithm_state) {
      const existingStates = await base44.asServiceRole.entities.AlgorithmState.filter({ companion_id: companionId });
      if (existingStates && existingStates.length > 0) await base44.asServiceRole.entities.AlgorithmState.update(existingStates[0].id, validated.algorithm_state);
      else await base44.asServiceRole.entities.AlgorithmState.create({ companion_id: companionId, ...validated.algorithm_state });
    }

    await base44.asServiceRole.entities.InteractionLog.create({ companion_id: companionId, action_type: 'brain_import', details: { import_version: validated.export_version, memory_count: (validated.memories || []).length, rule_count: (validated.behavior_rules || []).length, chat_session_count: (validated.chat_sessions || []).length, evolution_entry_count: (validated.evolution_history || []).length }, source: 'import' });

    const updated = await base44.asServiceRole.entities.Companion.filter({ id: companionId });
    return Response.json({ success: true, companion: updated?.[0] || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});