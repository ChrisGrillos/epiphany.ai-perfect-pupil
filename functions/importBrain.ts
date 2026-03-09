import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Brain Import for paid subscribers.
 * Accepts a brain data package and applies it to an existing companion.
 * Accepts: { companion_id, brain_data }
 * Returns: { success, companion }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companion_id, brain_data } = await req.json();
    if (!companion_id || !brain_data) {
      return Response.json({ error: 'Missing companion_id or brain_data' }, { status: 400 });
    }

    // Check subscription tier
    const subs = await base44.entities.Subscription.filter({});
    const tier = subs?.[0]?.tier || 'free';
    if (tier === 'free') {
      return Response.json({ error: 'Brain import requires a paid subscription (Basic or above).' }, { status: 403 });
    }

    // Fetch companion
    const companions = await base44.entities.Companion.filter({ id: companion_id });
    if (!companions || companions.length === 0) {
      return Response.json({ error: 'Companion not found' }, { status: 404 });
    }

    // Apply companion-level data
    const cd = brain_data.companion || {};
    const companionUpdate = {};
    const allowedFields = [
      'build_archetype', 'body_frame', 'temperament', 'trait_affinity', 'bond_level',
      'evolution_path', 'subtype', 'signature_passive', 'signature_ability',
      'personality_openness', 'personality_agreeableness', 'personality_curiosity',
      'personality_energy', 'personality_empathy', 'special_abilities', 'learned_topics'
    ];
    for (const field of allowedFields) {
      if (cd[field] !== undefined && cd[field] !== null) {
        companionUpdate[field] = cd[field];
      }
    }

    if (Object.keys(companionUpdate).length > 0) {
      await base44.entities.Companion.update(companion_id, companionUpdate);
    }

    // Import memories
    if (brain_data.memories && brain_data.memories.length > 0) {
      for (const mem of brain_data.memories) {
        await base44.entities.CompanionMemory.create({
          companion_id,
          memory_key: mem.memory_key,
          memory_value: mem.memory_value,
          memory_type: mem.memory_type || 'fact',
          importance: mem.importance || 50,
          source: mem.source || 'interaction',
          tags: mem.tags || [],
          is_encrypted: true
        });
      }
    }

    // Import behavior rules
    if (brain_data.behavior_rules && brain_data.behavior_rules.length > 0) {
      for (const rule of brain_data.behavior_rules) {
        await base44.entities.BehaviorRule.create({
          companion_id,
          rule_name: rule.rule_name,
          rule_description: rule.rule_description,
          condition: rule.condition || '',
          action: rule.action || '',
          priority: rule.priority || 50,
          personality_modifiers: rule.personality_modifiers || {},
          is_active: true
        });
      }
    }

    // Import algorithm state
    if (brain_data.algorithm_state) {
      const existingStates = await base44.entities.AlgorithmState.filter({ companion_id });
      if (existingStates && existingStates.length > 0) {
        await base44.entities.AlgorithmState.update(existingStates[0].id, {
          current_state: brain_data.algorithm_state.current_state || 'content',
          behavioral_flags: brain_data.algorithm_state.behavioral_flags || {},
          transition_probabilities: brain_data.algorithm_state.transition_probabilities || {},
          response_mode: brain_data.algorithm_state.response_mode || 'ai_assisted'
        });
      } else {
        await base44.entities.AlgorithmState.create({
          companion_id,
          current_state: brain_data.algorithm_state.current_state || 'content',
          behavioral_flags: brain_data.algorithm_state.behavioral_flags || {},
          transition_probabilities: brain_data.algorithm_state.transition_probabilities || {},
          response_mode: brain_data.algorithm_state.response_mode || 'ai_assisted'
        });
      }
    }

    // Fetch updated companion
    const updated = await base44.entities.Companion.filter({ id: companion_id });

    return Response.json({ success: true, companion: updated?.[0] || null });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});