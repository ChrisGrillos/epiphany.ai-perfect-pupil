import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  SCHEMA_ASSUMPTIONS,
  buildUserOwnerKeys,
  decryptJsonPayload,
  estimateJsonBytes,
  getOwnedRecordById,
  resolveUserEntitlements,
  recomputeCompanionIdentity
} from './_serverUtils.ts';

/**
 * Brain Import v2.
 * Accepts: { companion_id, brain_package, passphrase }
 * Returns: { success, companion }
 */

const BRAIN_IMPORT_RULES = Object.freeze({
  maxMemories: 2000,
  maxRules: 500,
  maxChatSessions: 250,
  maxChatMessagesPerSession: 500,
  maxEvolutionHistory: 1000,
  maxTagsPerMemory: 32,
  maxSpecialAbilities: 256,
  maxLearnedTopics: 512,
  maxString: 2048,
  maxLongText: 12000
});

const STAGE_ALLOWLIST = new Set(['infant', 'child', 'teenager', 'adult']);
const MEMORY_TYPE_ALLOWLIST = new Set(['fact', 'preference', 'event', 'emotion', 'skill']);
const CHAT_ROLE_ALLOWLIST = new Set(['user', 'companion', 'system']);
const CHAT_EMOTION_ALLOWLIST = new Set(['happy', 'curious', 'thoughtful', 'excited', 'calm', 'sad', 'frustrated', 'neutral', '']);
const RESPONSE_MODE_ALLOWLIST = new Set(['ai_assisted', 'default', 'fallback']);

const COMPANION_IMPORT_FIELDS = [
  'build_archetype', 'body_frame', 'temperament', 'trait_affinity', 'bond_level',
  'evolution_path', 'subtype', 'signature_passive', 'signature_ability',
  'personality_openness', 'personality_agreeableness', 'personality_curiosity',
  'personality_energy', 'personality_empathy', 'special_abilities', 'learned_topics'
];

const IDENTITY_TRIGGER_FIELDS = new Set([
  'build_archetype',
  'body_frame',
  'temperament',
  'trait_affinity',
  'bond_level',
  'evolution_path',
  'subtype'
]);

function isPlainObject(value: any): boolean {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeString(value: any, maxLength = BRAIN_IMPORT_RULES.maxString): string {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, maxLength);
}

function safeNumber(value: any, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeEnum(value: any, allowlist: Set<string>, fallback = ''): string {
  const candidate = safeString(value, 64).toLowerCase();
  return allowlist.has(candidate) ? candidate : fallback;
}

function isLikelyLegacyV1Package(brainPackage: any): boolean {
  if (!isPlainObject(brainPackage)) return false;
  const hasLegacyData =
    isPlainObject(brainPackage.companion) ||
    Array.isArray(brainPackage.memories) ||
    Array.isArray(brainPackage.behavior_rules);
  const hasCiphertext = typeof brainPackage.ciphertext_b64 === 'string';
  return hasLegacyData && !hasCiphertext;
}

function isValidEncryptedPackage(brainPackage: any): boolean {
  if (!isPlainObject(brainPackage)) return false;
  return Boolean(
    typeof brainPackage.salt_b64 === 'string' &&
    typeof brainPackage.iv_b64 === 'string' &&
    typeof brainPackage.ciphertext_b64 === 'string' &&
    isPlainObject(brainPackage.encryption)
  );
}

function sanitizeTraitAffinity(raw: any): Record<string, number> {
  const affinity = isPlainObject(raw) ? raw : {};
  return {
    aggressive: clamp(Math.round(safeNumber(affinity.aggressive, 0)), 0, 100),
    nurturing: clamp(Math.round(safeNumber(affinity.nurturing, 0)), 0, 100),
    curious: clamp(Math.round(safeNumber(affinity.curious, 0)), 0, 100),
    chaotic: clamp(Math.round(safeNumber(affinity.chaotic, 0)), 0, 100),
    disciplined: clamp(Math.round(safeNumber(affinity.disciplined, 0)), 0, 100)
  };
}

function sanitizeCompanionUpdate(companionData: any): Record<string, any> {
  const safeCompanion = isPlainObject(companionData) ? companionData : {};
  const update: Record<string, any> = {};

  for (const field of COMPANION_IMPORT_FIELDS) {
    if (safeCompanion[field] === undefined || safeCompanion[field] === null) continue;
    if (field === 'trait_affinity') {
      update.trait_affinity = sanitizeTraitAffinity(safeCompanion.trait_affinity);
      continue;
    }
    if (field === 'bond_level') {
      update.bond_level = clamp(Math.round(safeNumber(safeCompanion.bond_level, 0)), 0, 100);
      continue;
    }
    if (field.startsWith('personality_')) {
      update[field] = clamp(Math.round(safeNumber(safeCompanion[field], 0)), 0, 100);
      continue;
    }
    if (field === 'special_abilities') {
      if (!Array.isArray(safeCompanion.special_abilities)) continue;
      update.special_abilities = safeCompanion.special_abilities
        .slice(0, BRAIN_IMPORT_RULES.maxSpecialAbilities)
        .map((item: any) => safeString(item, 160))
        .filter(Boolean);
      continue;
    }
    if (field === 'learned_topics') {
      if (!Array.isArray(safeCompanion.learned_topics)) continue;
      update.learned_topics = safeCompanion.learned_topics
        .slice(0, BRAIN_IMPORT_RULES.maxLearnedTopics)
        .map((item: any) => safeString(item, 160))
        .filter(Boolean);
      continue;
    }
    update[field] = safeString(safeCompanion[field], field.includes('signature') ? 400 : 160);
  }

  return update;
}

function sanitizeMemories(rawMemories: any[]): any[] {
  if (!Array.isArray(rawMemories)) return [];
  if (rawMemories.length > BRAIN_IMPORT_RULES.maxMemories) {
    throw new Error(`Memory count exceeds limit (${BRAIN_IMPORT_RULES.maxMemories}).`);
  }

  const out = [];
  for (const mem of rawMemories) {
    if (!isPlainObject(mem)) continue;
    const memoryKey = safeString(mem.memory_key, 128);
    const memoryValue = safeString(mem.memory_value, BRAIN_IMPORT_RULES.maxLongText);
    if (!memoryKey || !memoryValue) continue;

    const memoryType = normalizeEnum(mem.memory_type, MEMORY_TYPE_ALLOWLIST, 'fact');
    const tags = Array.isArray(mem.tags)
      ? mem.tags.slice(0, BRAIN_IMPORT_RULES.maxTagsPerMemory).map((tag: any) => safeString(tag, 64)).filter(Boolean)
      : [];

    out.push({
      memory_key: memoryKey,
      memory_value: memoryValue,
      memory_type: memoryType,
      importance: clamp(Math.round(safeNumber(mem.importance, 50)), 0, 100),
      source: safeString(mem.source || 'import', 64),
      tags
    });
  }
  return out;
}

function sanitizeBehaviorRules(rawRules: any[]): any[] {
  if (!Array.isArray(rawRules)) return [];
  if (rawRules.length > BRAIN_IMPORT_RULES.maxRules) {
    throw new Error(`Behavior rule count exceeds limit (${BRAIN_IMPORT_RULES.maxRules}).`);
  }

  const out = [];
  for (const rule of rawRules) {
    if (!isPlainObject(rule)) continue;
    const ruleName = safeString(rule.rule_name, 160);
    if (!ruleName) continue;

    out.push({
      rule_name: ruleName,
      rule_description: safeString(rule.rule_description, 2000),
      condition: safeString(rule.condition, 1000),
      action: safeString(rule.action, 1000),
      priority: clamp(Math.round(safeNumber(rule.priority, 50)), 0, 100),
      personality_modifiers: isPlainObject(rule.personality_modifiers) ? rule.personality_modifiers : {}
    });
  }
  return out;
}

function sanitizeChatSessions(rawSessions: any, rawLegacyMessages: any): any[] {
  const sessions = Array.isArray(rawSessions) ? rawSessions : [];
  if (sessions.length > BRAIN_IMPORT_RULES.maxChatSessions) {
    throw new Error(`Chat session count exceeds limit (${BRAIN_IMPORT_RULES.maxChatSessions}).`);
  }

  const out = [];
  for (const session of sessions) {
    if (!isPlainObject(session)) continue;
    const rawMessages = Array.isArray(session.messages) ? session.messages : [];
    if (rawMessages.length > BRAIN_IMPORT_RULES.maxChatMessagesPerSession) {
      throw new Error(`A chat session exceeds message limit (${BRAIN_IMPORT_RULES.maxChatMessagesPerSession}).`);
    }

    const messages = rawMessages
      .map((msg: any) => {
        if (!isPlainObject(msg)) return null;
        const role = normalizeEnum(msg.role, CHAT_ROLE_ALLOWLIST, '');
        const content = safeString(msg.content, BRAIN_IMPORT_RULES.maxLongText);
        const emotion = normalizeEnum(msg.emotion_tag, CHAT_EMOTION_ALLOWLIST, 'neutral');
        if (!role || !content) return null;
        return { role, content, emotion_tag: emotion };
      })
      .filter(Boolean);

    out.push({
      title: safeString(session.title, 160),
      mood_at_start: safeString(session.mood_at_start, 64),
      mood_at_end: safeString(session.mood_at_end, 64),
      trust_delta: safeNumber(session.trust_delta, 0),
      messages
    });
  }

  // Migration path for older v2 exports that had top-level chat_messages without per-session grouping.
  const hasAnyMessages = out.some((session: any) => Array.isArray(session.messages) && session.messages.length > 0);
  if (!hasAnyMessages && Array.isArray(rawLegacyMessages) && rawLegacyMessages.length > 0) {
    if (rawLegacyMessages.length > BRAIN_IMPORT_RULES.maxChatMessagesPerSession) {
      throw new Error(`Legacy chat message count exceeds limit (${BRAIN_IMPORT_RULES.maxChatMessagesPerSession}).`);
    }
    const migratedMessages = rawLegacyMessages
      .map((msg: any) => {
        if (!isPlainObject(msg)) return null;
        const role = normalizeEnum(msg.role, CHAT_ROLE_ALLOWLIST, '');
        const content = safeString(msg.content, BRAIN_IMPORT_RULES.maxLongText);
        const emotion = normalizeEnum(msg.emotion_tag, CHAT_EMOTION_ALLOWLIST, 'neutral');
        if (!role || !content) return null;
        return { role, content, emotion_tag: emotion };
      })
      .filter(Boolean);
    if (out.length > 0) {
      out[0].messages = migratedMessages;
    } else {
      out.push({
        title: 'Imported Session (Legacy)',
        mood_at_start: '',
        mood_at_end: '',
        trust_delta: 0,
        messages: migratedMessages
      });
    }
  }

  return out;
}

function sanitizeEvolutionHistory(rawHistory: any[]): any[] {
  if (!Array.isArray(rawHistory)) return [];
  if (rawHistory.length > BRAIN_IMPORT_RULES.maxEvolutionHistory) {
    throw new Error(`Evolution history count exceeds limit (${BRAIN_IMPORT_RULES.maxEvolutionHistory}).`);
  }

  const out = [];
  for (const entry of rawHistory) {
    if (!isPlainObject(entry)) continue;
    const fromStage = normalizeEnum(entry.from_stage, STAGE_ALLOWLIST, '');
    const toStage = normalizeEnum(entry.to_stage, STAGE_ALLOWLIST, '');
    if (!fromStage && !toStage) continue;

    out.push({
      from_stage: fromStage || null,
      to_stage: toStage || null,
      success: Boolean(entry.success),
      stat_changes: isPlainObject(entry.stat_changes) ? entry.stat_changes : {},
      failure_reason: safeString(entry.failure_reason, 512)
    });
  }
  return out;
}

function sanitizeAlgorithmState(rawAlgorithmState: any): any | null {
  if (!isPlainObject(rawAlgorithmState)) return null;
  const responseMode = normalizeEnum(rawAlgorithmState.response_mode, RESPONSE_MODE_ALLOWLIST, 'ai_assisted');
  return {
    current_state: safeString(rawAlgorithmState.current_state, 64) || 'content',
    behavioral_flags: isPlainObject(rawAlgorithmState.behavioral_flags) ? rawAlgorithmState.behavioral_flags : {},
    transition_probabilities: isPlainObject(rawAlgorithmState.transition_probabilities) ? rawAlgorithmState.transition_probabilities : {},
    response_mode: responseMode
  };
}

function validateDecryptedBrainData(rawBrainData: any): any {
  if (!isPlainObject(rawBrainData)) {
    throw new Error('Decrypted payload is invalid.');
  }

  const exportVersion = safeString(rawBrainData.export_version, 16);
  if (exportVersion && !exportVersion.startsWith('2.')) {
    throw new Error(`Unsupported brain payload version: ${exportVersion}`);
  }

  return {
    export_version: exportVersion || '2.0.0',
    companion_update: sanitizeCompanionUpdate(rawBrainData.companion || {}),
    memories: sanitizeMemories(rawBrainData.memories),
    behavior_rules: sanitizeBehaviorRules(rawBrainData.behavior_rules),
    chat_sessions: sanitizeChatSessions(rawBrainData.chat_sessions, rawBrainData.chat_messages),
    evolution_history: sanitizeEvolutionHistory(rawBrainData.evolution_history),
    algorithm_state: sanitizeAlgorithmState(rawBrainData.algorithm_state)
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companion_id, brain_package, passphrase } = await req.json();
    if (!companion_id || !brain_package) {
      return Response.json({ error: 'Missing companion_id or brain_package' }, { status: 400 });
    }
    if (typeof passphrase !== 'string' || passphrase.length < 8) {
      return Response.json({ error: 'A passphrase of at least 8 characters is required for encrypted import.' }, { status: 400 });
    }

    const packageBytes = estimateJsonBytes(brain_package);
    if (packageBytes > SCHEMA_ASSUMPTIONS.maxEncryptedImportBytes) {
      return Response.json({ error: 'Encrypted package is too large.' }, { status: 413 });
    }
    if (isLikelyLegacyV1Package(brain_package)) {
      return Response.json(
        { error: 'Legacy v1 plaintext exports are not supported. Re-export this brain using secure v2 format first.' },
        { status: 400 }
      );
    }
    if (!isValidEncryptedPackage(brain_package)) {
      return Response.json({ error: 'Invalid encrypted brain package format.' }, { status: 400 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!entitlements.is_paid) {
      return Response.json(
        { error: `Brain import requires a paid subscription (Basic or above). Your current tier is ${entitlements.tier}.` },
        { status: 403 }
      );
    }

    const companionId = String(companion_id);
    const targetCompanion = await getOwnedRecordById(base44, 'Companion', companionId, ownerKeys);
    if (!targetCompanion) {
      return Response.json({ error: 'Companion not found or not owned by caller' }, { status: 404 });
    }

    let decryptedPayload: any;
    try {
      decryptedPayload = await decryptJsonPayload(brain_package, passphrase);
    } catch (error) {
      return Response.json({ error: error.message || 'Unable to decrypt brain package.' }, { status: 400 });
    }

    let validated: any;
    try {
      validated = validateDecryptedBrainData(decryptedPayload);
    } catch (error) {
      return Response.json({ error: error.message || 'Brain payload validation failed.' }, { status: 400 });
    }

    const companionUpdate = validated.companion_update || {};
    const shouldRecomputeIdentity = Object.keys(companionUpdate).some((field) =>
      IDENTITY_TRIGGER_FIELDS.has(field)
    );
    if (shouldRecomputeIdentity) {
      Object.assign(
        companionUpdate,
        recomputeCompanionIdentity(
          { ...targetCompanion, ...companionUpdate },
          { recomputedAt: new Date().toISOString() }
        )
      );
    }
    if (Object.keys(companionUpdate).length > 0) {
      await base44.asServiceRole.entities.Companion.update(companionId, companionUpdate);
    }

    const existingMemories = await base44.asServiceRole.entities.CompanionMemory.filter({ companion_id: companionId });
    const existingMemoryByKey = new Map((existingMemories || []).map((m: any) => [m.memory_key, m]));
    for (const mem of validated.memories || []) {
      const payload = {
        companion_id: companionId,
        memory_key: mem.memory_key,
        memory_value: mem.memory_value,
        memory_type: mem.memory_type,
        importance: mem.importance,
        source: mem.source || 'import',
        tags: mem.tags,
        is_encrypted: true
      };
      const existing = existingMemoryByKey.get(mem.memory_key);
      if (existing) {
        await base44.asServiceRole.entities.CompanionMemory.update(existing.id, payload);
      } else {
        const created = await base44.asServiceRole.entities.CompanionMemory.create(payload);
        existingMemoryByKey.set(mem.memory_key, created);
      }
    }

    const existingRules = await base44.asServiceRole.entities.BehaviorRule.filter({ companion_id: companionId });
    const existingRuleByName = new Map((existingRules || []).map((r: any) => [r.rule_name, r]));
    for (const rule of validated.behavior_rules || []) {
      const payload = {
        companion_id: companionId,
        rule_name: rule.rule_name,
        rule_description: rule.rule_description,
        condition: rule.condition,
        action: rule.action,
        priority: rule.priority,
        personality_modifiers: rule.personality_modifiers || {},
        is_active: true
      };
      const existing = existingRuleByName.get(rule.rule_name);
      if (existing) {
        await base44.asServiceRole.entities.BehaviorRule.update(existing.id, payload);
      } else {
        const created = await base44.asServiceRole.entities.BehaviorRule.create(payload);
        existingRuleByName.set(rule.rule_name, created);
      }
    }

    for (const session of validated.chat_sessions || []) {
      const createdSession = await base44.asServiceRole.entities.ChatSession.create({
        companion_id: companionId,
        title: session.title || 'Imported Session',
        message_count: session.messages.length,
        mood_at_start: session.mood_at_start || '',
        mood_at_end: session.mood_at_end || '',
        trust_delta: session.trust_delta || 0,
        last_message_at: new Date().toISOString()
      });
      for (const message of session.messages) {
        await base44.asServiceRole.entities.ChatMessage.create({
          session_id: createdSession.id,
          companion_id: companionId,
          role: message.role,
          content: message.content,
          emotion_tag: message.emotion_tag || 'neutral'
        });
      }
    }

    for (const attempt of validated.evolution_history || []) {
      await base44.asServiceRole.entities.EvolutionAttempt.create({
        companion_id: companionId,
        puzzle_id: null,
        from_stage: attempt.from_stage,
        to_stage: attempt.to_stage,
        success: attempt.success,
        stat_changes: attempt.stat_changes,
        failure_reason: attempt.failure_reason || null,
        xp_cost: 0,
        pcp_reward: 0
      });
    }

    if (validated.algorithm_state) {
      const existingStates = await base44.asServiceRole.entities.AlgorithmState.filter({ companion_id: companionId });
      if (existingStates && existingStates.length > 0) {
        await base44.asServiceRole.entities.AlgorithmState.update(existingStates[0].id, validated.algorithm_state);
      } else {
        await base44.asServiceRole.entities.AlgorithmState.create({
          companion_id: companionId,
          ...validated.algorithm_state
        });
      }
    }

    await base44.asServiceRole.entities.InteractionLog.create({
      companion_id: companionId,
      action_type: 'brain_import',
      details: {
        import_version: validated.export_version,
        memory_count: (validated.memories || []).length,
        rule_count: (validated.behavior_rules || []).length,
        chat_session_count: (validated.chat_sessions || []).length,
        evolution_entry_count: (validated.evolution_history || []).length
      },
      source: 'import'
    });

    const updated = await base44.asServiceRole.entities.Companion.filter({ id: companionId });
    return Response.json({ success: true, companion: updated?.[0] || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
