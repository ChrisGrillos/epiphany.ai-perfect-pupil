import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Memory-aware companion chat handler.
 * Fetches companion identity, memories, and behavior rules,
 * then generates a trait-driven response via LLM.
 * Accepts: { companion_id, message, session_id? }
 * Returns: { response, emotion, memories_referenced, memory_created }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companion_id, message, session_id } = await req.json();
    if (!companion_id || !message) {
      return Response.json({ error: 'Missing companion_id or message' }, { status: 400 });
    }

    // Fetch companion, memories, and behavior rules in parallel
    const [companions, memories, rules] = await Promise.all([
      base44.entities.Companion.filter({ id: companion_id }),
      base44.entities.CompanionMemory.filter({ companion_id }),
      base44.entities.BehaviorRule.filter({ companion_id })
    ]);

    if (!companions || companions.length === 0) {
      return Response.json({ error: 'Companion not found' }, { status: 404 });
    }

    const companion = companions[0];
    const aff = companion.trait_affinity || { aggressive: 0, nurturing: 0, curious: 0, chaotic: 0, disciplined: 0 };

    // Build memory context (top 20 by importance)
    const sortedMemories = (memories || [])
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 20);

    const memoryContext = sortedMemories.length > 0
      ? sortedMemories.map(m => `[${m.memory_type}/${m.importance}] ${m.memory_key}: ${m.memory_value}`).join('\n')
      : 'No memories yet — this companion is still getting to know their caretaker.';

    // Build behavior rules context (active only, sorted by priority)
    const activeRules = (rules || [])
      .filter(r => r.is_active)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const rulesContext = activeRules.length > 0
      ? activeRules.map(r => `[Priority ${r.priority}] When: ${r.condition} → Do: ${r.action}`).join('\n')
      : 'No special behavior rules set.';

    // Determine dominant trait
    const traits = Object.entries(aff).sort((a, b) => b[1] - a[1]);
    const dominantTrait = traits[0]?.[0] || 'curious';
    const secondaryTrait = traits[1]?.[0] || 'nurturing';

    // Stage-based speech instructions
    const stageInstructions = {
      infant: 'Speak in very simple words, baby-like. Use sounds like "ooh!", "ahh!", "yay!". Maximum 1-2 short sentences.',
      child: 'Speak like a curious young child. Ask questions. Use simple excited sentences. 2-3 sentences max.',
      teenager: 'Speak like a teenager — more complex thoughts, developing opinions, can be moody or sarcastic. Use some slang. 3-4 sentences.',
      adult: 'Speak articulately with emotional depth. Can have deep philosophical conversations. Wise but still warm.'
    };

    const prompt = `You ARE ${companion.name}, a ${companion.species} Perfect Pupil at the ${companion.stage} stage.

=== YOUR IDENTITY ===
Species: ${companion.species}
Stage: ${companion.stage}
Mood: ${companion.mood}
Archetype: ${companion.build_archetype || 'Adaptive'}
Temperament: ${companion.temperament || 'Calm'}
Bond with caretaker: ${companion.bond_level || 0}/100
Trust level: ${companion.trust_level || 0}/100
Knowledge: ${companion.knowledge_level || 0}/100

=== YOUR PERSONALITY TRAITS ===
Dominant: ${dominantTrait} (${aff[dominantTrait] || 0})
Secondary: ${secondaryTrait} (${aff[secondaryTrait] || 0})
Full affinity: aggressive=${aff.aggressive || 0}, nurturing=${aff.nurturing || 0}, curious=${aff.curious || 0}, chaotic=${aff.chaotic || 0}, disciplined=${aff.disciplined || 0}

=== YOUR MEMORIES ===
${memoryContext}

=== BEHAVIOR RULES (you MUST follow these) ===
${rulesContext}

=== SPEECH STYLE ===
${stageInstructions[companion.stage] || stageInstructions.child}

=== INSTRUCTIONS ===
1. Respond IN CHARACTER as ${companion.name}. Never break character.
2. Reference relevant memories naturally if applicable.
3. Follow behavior rules — higher priority rules override lower ones.
4. If you learn something new about the user, note it in new_memory.
5. Be emotionally genuine based on your mood and bond level.
6. Never lie or fabricate facts. If unsure, say so.

User message: "${message}"`;

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          response: { type: 'string', description: 'The companion response text' },
          emotion: { type: 'string', enum: ['happy', 'curious', 'thoughtful', 'excited', 'calm', 'sad', 'frustrated', 'neutral'] },
          new_memory: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
              type: { type: 'string', enum: ['fact', 'preference', 'event', 'emotion', 'skill'] },
              importance: { type: 'number' },
              tags: { type: 'array', items: { type: 'string' } }
            },
            description: 'Set ONLY if the user revealed something new worth remembering. Otherwise null.'
          },
          memories_referenced: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of memory_key values that were referenced in the response'
          }
        }
      }
    });

    // Save new memory if created
    let memoryCreated = null;
    if (llmResponse.new_memory && llmResponse.new_memory.key) {
      const newMem = await base44.entities.CompanionMemory.create({
        companion_id,
        memory_key: llmResponse.new_memory.key,
        memory_value: llmResponse.new_memory.value,
        memory_type: llmResponse.new_memory.type || 'fact',
        importance: llmResponse.new_memory.importance || 50,
        source: 'interaction',
        tags: llmResponse.new_memory.tags || [],
        is_encrypted: true
      });
      memoryCreated = newMem;
    }

    // Update recall counts for referenced memories
    if (llmResponse.memories_referenced && llmResponse.memories_referenced.length > 0) {
      for (const memKey of llmResponse.memories_referenced) {
        const matching = sortedMemories.find(m => m.memory_key === memKey);
        if (matching) {
          await base44.entities.CompanionMemory.update(matching.id, {
            recall_count: (matching.recall_count || 0) + 1,
            last_recalled: new Date().toISOString()
          });
        }
      }
    }

    // Update companion trust and last interaction
    await base44.entities.Companion.update(companion_id, {
      trust_level: Math.min(100, (companion.trust_level || 0) + 1),
      last_interaction: new Date().toISOString()
    });

    // Save chat messages if session provided
    if (session_id) {
      await base44.entities.ChatMessage.create({
        session_id,
        companion_id,
        role: 'user',
        content: message,
        emotion_tag: 'neutral'
      });
      await base44.entities.ChatMessage.create({
        session_id,
        companion_id,
        role: 'companion',
        content: llmResponse.response,
        emotion_tag: llmResponse.emotion || 'neutral',
        memories_referenced: llmResponse.memories_referenced || [],
        memories_created: memoryCreated ? [memoryCreated.id] : []
      });
      // Update session message count
      const sessions = await base44.entities.ChatSession.filter({ id: session_id });
      if (sessions && sessions.length > 0) {
        await base44.entities.ChatSession.update(session_id, {
          message_count: (sessions[0].message_count || 0) + 2,
          last_message_at: new Date().toISOString()
        });
      }
    }

    return Response.json({
      response: llmResponse.response,
      emotion: llmResponse.emotion || 'neutral',
      memories_referenced: llmResponse.memories_referenced || [],
      memory_created: memoryCreated ? { key: memoryCreated.memory_key, value: memoryCreated.memory_value } : null
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});