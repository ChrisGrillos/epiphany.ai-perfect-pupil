import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Brain Export for paid subscribers.
 * Exports all companion memory, behavior rules, chat history, evolution data,
 * algorithm state, and trait/temperament data as a JSON package.
 * Accepts: { companion_id }
 * Returns: { brain_data } (JSON object containing all exportable data)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companion_id } = await req.json();
    if (!companion_id) {
      return Response.json({ error: 'Missing companion_id' }, { status: 400 });
    }

    // Check subscription tier (must be basic or above)
    const subs = await base44.entities.Subscription.filter({});
    const tier = subs?.[0]?.tier || 'free';
    if (tier === 'free') {
      return Response.json({ error: 'Brain export requires a paid subscription (Basic or above).' }, { status: 403 });
    }

    // Fetch companion
    const companions = await base44.entities.Companion.filter({ id: companion_id });
    if (!companions || companions.length === 0) {
      return Response.json({ error: 'Companion not found' }, { status: 404 });
    }
    const companion = companions[0];

    // Fetch all related data in parallel
    const [memories, rules, sessions, evolutionAttempts, algorithmStates] = await Promise.all([
      base44.entities.CompanionMemory.filter({ companion_id }),
      base44.entities.BehaviorRule.filter({ companion_id }),
      base44.entities.ChatSession.filter({ companion_id }),
      base44.entities.EvolutionAttempt.filter({ companion_id }),
      base44.entities.AlgorithmState.filter({ companion_id })
    ]);

    // Fetch chat messages for each session
    const chatMessages = [];
    for (const session of (sessions || [])) {
      const msgs = await base44.entities.ChatMessage.filter({ session_id: session.id });
      chatMessages.push(...(msgs || []));
    }

    // Build the brain export package
    const brainData = {
      export_version: '1.0.0',
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      companion: {
        name: companion.name,
        species: companion.species,
        stage: companion.stage,
        starting_stage: companion.starting_stage,
        build_archetype: companion.build_archetype,
        body_frame: companion.body_frame,
        temperament: companion.temperament,
        trait_affinity: companion.trait_affinity,
        bond_level: companion.bond_level,
        evolution_path: companion.evolution_path,
        subtype: companion.subtype,
        signature_passive: companion.signature_passive,
        signature_ability: companion.signature_ability,
        personality_openness: companion.personality_openness,
        personality_agreeableness: companion.personality_agreeableness,
        personality_curiosity: companion.personality_curiosity,
        personality_energy: companion.personality_energy,
        personality_empathy: companion.personality_empathy,
        knowledge_level: companion.knowledge_level,
        experience_points: companion.experience_points,
        level: companion.level,
        trust_level: companion.trust_level,
        affection_level: companion.affection_level,
        mood: companion.mood,
        special_abilities: companion.special_abilities,
        learned_topics: companion.learned_topics,
        combat_damage_dealt: companion.combat_damage_dealt,
        combat_damage_blocked: companion.combat_damage_blocked,
        combat_healing_done: companion.combat_healing_done,
        combat_ally_saves: companion.combat_ally_saves,
        combat_status_inflicted: companion.combat_status_inflicted
      },
      memories: (memories || []).map(m => ({
        memory_key: m.memory_key,
        memory_value: m.memory_value,
        memory_type: m.memory_type,
        importance: m.importance,
        source: m.source,
        tags: m.tags
      })),
      behavior_rules: (rules || []).map(r => ({
        rule_name: r.rule_name,
        rule_description: r.rule_description,
        condition: r.condition,
        action: r.action,
        priority: r.priority,
        personality_modifiers: r.personality_modifiers
      })),
      chat_sessions: (sessions || []).map(s => ({
        title: s.title,
        message_count: s.message_count,
        mood_at_start: s.mood_at_start,
        mood_at_end: s.mood_at_end,
        trust_delta: s.trust_delta
      })),
      chat_messages: chatMessages.map(m => ({
        role: m.role,
        content: m.content,
        emotion_tag: m.emotion_tag
      })),
      evolution_history: (evolutionAttempts || []).map(e => ({
        from_stage: e.from_stage,
        to_stage: e.to_stage,
        success: e.success,
        stat_changes: e.stat_changes,
        failure_reason: e.failure_reason
      })),
      algorithm_state: algorithmStates?.[0] ? {
        current_state: algorithmStates[0].current_state,
        behavioral_flags: algorithmStates[0].behavioral_flags,
        transition_probabilities: algorithmStates[0].transition_probabilities,
        response_mode: algorithmStates[0].response_mode
      } : null
    };

    return Response.json({ brain_data: brainData });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});