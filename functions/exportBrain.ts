import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  encryptJsonPayload,
  getOwnedRecordById,
  resolveUserEntitlements
} from './_serverUtils.ts';

/**
 * Brain Export v2.
 * Accepts: { companion_id, passphrase }
 * Returns: { brain_package, metadata }
 */

const EXPORT_VERSION = '2.1.0';
const EXPORT_LIMITS = Object.freeze({
  maxMemories: 2000,
  maxRules: 500,
  maxChatSessions: 250,
  maxChatMessagesPerSession: 500,
  maxEvolutionHistory: 1000,
  maxTagsPerMemory: 32,
  maxString: 2048,
  maxLongText: 12000
});

function safeString(value: any, maxLength = EXPORT_LIMITS.maxString): string {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, maxLength);
}

function safeArray<T>(value: T[], maxLength: number): T[] {
  return Array.isArray(value) ? value.slice(0, maxLength) : [];
}

async function exportChatSessions(base44: any, companionId: string): Promise<any[]> {
  const sessions = safeArray(
    await base44.asServiceRole.entities.ChatSession.filter({ companion_id: companionId }),
    EXPORT_LIMITS.maxChatSessions
  );

  const out = [];
  for (const session of sessions) {
    const messages = safeArray(
      await base44.asServiceRole.entities.ChatMessage.filter({ session_id: session.id }),
      EXPORT_LIMITS.maxChatMessagesPerSession
    ).map((m: any) => ({
      role: safeString(m.role, 20),
      content: safeString(m.content, EXPORT_LIMITS.maxLongText),
      emotion_tag: safeString(m.emotion_tag, 32),
      memories_referenced: safeArray(m.memories_referenced, 64).map((x: any) => safeString(x, 128)),
      memories_created: safeArray(m.memories_created, 64).map((x: any) => safeString(x, 128)),
      created_at: m.created_date || m.created_at || null
    }));

    out.push({
      title: safeString(session.title, 160),
      message_count: Number(session.message_count || messages.length),
      mood_at_start: safeString(session.mood_at_start, 64),
      mood_at_end: safeString(session.mood_at_end, 64),
      trust_delta: Number(session.trust_delta || 0),
      created_at: session.created_date || session.created_at || null,
      messages
    });
  }

  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companion_id, passphrase } = await req.json();
    if (!companion_id) {
      return Response.json({ error: 'Missing companion_id' }, { status: 400 });
    }
    if (typeof passphrase !== 'string' || passphrase.length < 8) {
      return Response.json({ error: 'A passphrase of at least 8 characters is required for encrypted export.' }, { status: 400 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!entitlements.is_paid) {
      return Response.json(
        { error: `Brain export requires a paid subscription (Basic or above). Your current tier is ${entitlements.tier}.` },
        { status: 403 }
      );
    }

    const companion = await getOwnedRecordById(base44, 'Companion', String(companion_id), ownerKeys);
    if (!companion) {
      return Response.json({ error: 'Companion not found or not owned by caller' }, { status: 404 });
    }

    const [rawMemories, rawRules, rawEvolutionAttempts, rawAlgorithmStates, chatSessions] = await Promise.all([
      base44.asServiceRole.entities.CompanionMemory.filter({ companion_id }),
      base44.asServiceRole.entities.BehaviorRule.filter({ companion_id }),
      base44.asServiceRole.entities.EvolutionAttempt.filter({ companion_id }),
      base44.asServiceRole.entities.AlgorithmState.filter({ companion_id }),
      exportChatSessions(base44, String(companion_id))
    ]);

    const memories = safeArray(rawMemories, EXPORT_LIMITS.maxMemories).map((m: any) => ({
      memory_key: safeString(m.memory_key, 128),
      memory_value: safeString(m.memory_value, EXPORT_LIMITS.maxLongText),
      memory_type: safeString(m.memory_type, 32),
      importance: Number(m.importance || 50),
      source: safeString(m.source, 64),
      tags: safeArray(m.tags, EXPORT_LIMITS.maxTagsPerMemory).map((tag: any) => safeString(tag, 64))
    }));

    const behaviorRules = safeArray(rawRules, EXPORT_LIMITS.maxRules).map((r: any) => ({
      rule_name: safeString(r.rule_name, 160),
      rule_description: safeString(r.rule_description, 2000),
      condition: safeString(r.condition, 1000),
      action: safeString(r.action, 1000),
      priority: Number(r.priority || 50),
      personality_modifiers: typeof r.personality_modifiers === 'object' && r.personality_modifiers ? r.personality_modifiers : {}
    }));

    const evolutionHistory = safeArray(rawEvolutionAttempts, EXPORT_LIMITS.maxEvolutionHistory).map((e: any) => ({
      from_stage: safeString(e.from_stage, 32),
      to_stage: safeString(e.to_stage, 32),
      success: Boolean(e.success),
      stat_changes: typeof e.stat_changes === 'object' && e.stat_changes ? e.stat_changes : {},
      failure_reason: safeString(e.failure_reason, 512)
    }));

    const algorithmState = rawAlgorithmStates?.[0]
      ? {
          current_state: safeString(rawAlgorithmStates[0].current_state, 64),
          behavioral_flags: typeof rawAlgorithmStates[0].behavioral_flags === 'object' && rawAlgorithmStates[0].behavioral_flags ? rawAlgorithmStates[0].behavioral_flags : {},
          transition_probabilities: typeof rawAlgorithmStates[0].transition_probabilities === 'object' && rawAlgorithmStates[0].transition_probabilities ? rawAlgorithmStates[0].transition_probabilities : {},
          response_mode: safeString(rawAlgorithmStates[0].response_mode, 64)
        }
      : null;

    const exportedAt = new Date().toISOString();
    const brainData = {
      export_version: EXPORT_VERSION,
      exported_at: exportedAt,
      companion_id: companion.id,
      companion: {
        name: safeString(companion.name, 120),
        species: safeString(companion.species, 64),
        stage: safeString(companion.stage, 32),
        starting_stage: safeString(companion.starting_stage, 32),
        build_archetype: safeString(companion.build_archetype, 64),
        body_frame: safeString(companion.body_frame, 64),
        temperament: safeString(companion.temperament, 64),
        trait_affinity: companion.trait_affinity || {},
        bond_level: Number(companion.bond_level || 0),
        evolution_path: safeString(companion.evolution_path, 64),
        subtype: safeString(companion.subtype, 64),
        signature_passive: safeString(companion.signature_passive, 400),
        signature_ability: safeString(companion.signature_ability, 400),
        personality_openness: Number(companion.personality_openness || 0),
        personality_agreeableness: Number(companion.personality_agreeableness || 0),
        personality_curiosity: Number(companion.personality_curiosity || 0),
        personality_energy: Number(companion.personality_energy || 0),
        personality_empathy: Number(companion.personality_empathy || 0),
        knowledge_level: Number(companion.knowledge_level || 0),
        experience_points: Number(companion.experience_points || 0),
        level: Number(companion.level || 1),
        trust_level: Number(companion.trust_level || 0),
        affection_level: Number(companion.affection_level || 0),
        mood: safeString(companion.mood, 64),
        special_abilities: safeArray(companion.special_abilities, 256).map((x: any) => safeString(x, 160)),
        learned_topics: safeArray(companion.learned_topics, 512).map((x: any) => safeString(x, 160)),
        combat_damage_dealt: Number(companion.combat_damage_dealt || 0),
        combat_damage_blocked: Number(companion.combat_damage_blocked || 0),
        combat_healing_done: Number(companion.combat_healing_done || 0),
        combat_ally_saves: Number(companion.combat_ally_saves || 0),
        combat_status_inflicted: Number(companion.combat_status_inflicted || 0)
      },
      memories,
      behavior_rules: behaviorRules,
      chat_sessions: chatSessions,
      evolution_history: evolutionHistory,
      algorithm_state: algorithmState
    };

    const plaintextMetadata = {
      companion_id: companion.id,
      companion_name: safeString(companion.name, 120),
      stage: safeString(companion.stage, 32),
      exported_at: exportedAt,
      export_version: EXPORT_VERSION,
      counts: {
        memories: memories.length,
        behavior_rules: behaviorRules.length,
        chat_sessions: chatSessions.length,
        evolution_history: evolutionHistory.length
      }
    };

    const brainPackage = await encryptJsonPayload(brainData, passphrase, {
      metadata: plaintextMetadata,
      version: EXPORT_VERSION
    });

    return Response.json({
      brain_package: brainPackage,
      metadata: plaintextMetadata
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
