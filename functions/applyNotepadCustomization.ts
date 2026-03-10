import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  clampStat,
  getOwnedRecordById,
  isTierAtLeast,
  resolveUserEntitlements
} from './_serverUtils.ts';

const CUSTOMIZATION_LIMITS = {
  free: { traits: 0, memories: 0, rules: 0 },
  basic: { traits: 3, memories: 5, rules: 2 },
  premium: { traits: 10, memories: 20, rules: 10 },
  elite: { traits: 999, memories: 999, rules: 999 }
};

const TRAIT_FIELD_MAP = {
  wit: 'personality_openness',
  witty: 'personality_openness',
  calm: 'personality_agreeableness',
  patient: 'personality_agreeableness',
  curious: 'personality_curiosity',
  energetic: 'personality_energy',
  empathetic: 'personality_empathy',
  supportive: 'personality_empathy'
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const companionId = String(payload?.companion_id || '').trim();
    const content = String(payload?.content || '').trim();
    if (!companionId || !content) {
      return Response.json({ error: 'Missing companion_id or content.' }, { status: 400 });
    }
    if (content.length > 12000) {
      return Response.json({ error: 'Customization text is too long.' }, { status: 413 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const entitlements = await resolveUserEntitlements(base44, ownerKeys);
    if (!isTierAtLeast(entitlements.tier, 'basic')) {
      return Response.json(
        { error: `Natural language customization requires Basic or above. Your current tier is ${entitlements.tier}.` },
        { status: 403 }
      );
    }

    const companion = await getOwnedRecordById(base44, 'Companion', companionId, ownerKeys);
    if (!companion) {
      return Response.json({ error: 'Companion not found or not owned by caller.' }, { status: 404 });
    }

    const limits = CUSTOMIZATION_LIMITS[entitlements.tier] || CUSTOMIZATION_LIMITS.free;
    const [existingMemories, existingRules] = await Promise.all([
      base44.asServiceRole.entities.CompanionMemory.filter({ companion_id: companionId }),
      base44.asServiceRole.entities.BehaviorRule.filter({ companion_id: companionId })
    ]);

    const parseResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a behavior parser for an AI companion. Extract structured customization data from the following natural language input.

Input: "${content}"

Extract and return:
1. Personality traits (e.g., {name: "wit", value: 75} where value is 0-100)
2. Memories (key-value pairs like {key: "favorite_color", value: "blue"})
3. Behavior rules (conditions and actions, e.g., {name: "morning_greeting", description: "Be extra cheerful in morning", condition: "time_is_morning", action: "use_cheerful_tone"})

Be specific and actionable. If the input is vague, make reasonable interpretations.`,
      response_json_schema: {
        type: 'object',
        properties: {
          traits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' }
              }
            }
          },
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                value: { type: 'string' },
                type: { type: 'string', enum: ['fact', 'preference', 'event', 'emotion', 'skill'] }
              }
            }
          },
          rules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                condition: { type: 'string' },
                action: { type: 'string' },
                priority: { type: 'number' }
              }
            }
          }
        }
      }
    });

    const parsedTraits = Array.isArray(parseResult?.traits) ? parseResult.traits : [];
    const parsedMemories = Array.isArray(parseResult?.memories) ? parseResult.memories : [];
    const parsedRules = Array.isArray(parseResult?.rules) ? parseResult.rules : [];

    if (existingMemories.length + parsedMemories.length > limits.memories) {
      return Response.json(
        { error: `This action would exceed your memory limit (${limits.memories}) for ${entitlements.tier} tier.` },
        { status: 403 }
      );
    }
    if (existingRules.length + parsedRules.length > limits.rules) {
      return Response.json(
        { error: `This action would exceed your behavior rule limit (${limits.rules}) for ${entitlements.tier} tier.` },
        { status: 403 }
      );
    }

    const traitsToApply = parsedTraits.slice(0, limits.traits);
    const createdMemories = [];
    const createdRules = [];

    for (const memory of parsedMemories) {
      if (!memory?.key || !memory?.value) continue;
      const created = await base44.asServiceRole.entities.CompanionMemory.create({
        companion_id: companionId,
        memory_key: String(memory.key).trim(),
        memory_value: String(memory.value).trim(),
        memory_type: memory.type || 'fact',
        importance: 70,
        source: 'notepad',
        is_encrypted: true,
        tags: []
      });
      createdMemories.push(created);
    }

    for (const rule of parsedRules) {
      if (!rule?.name) continue;
      const created = await base44.asServiceRole.entities.BehaviorRule.create({
        companion_id: companionId,
        rule_name: String(rule.name).trim(),
        rule_description: rule.description || '',
        condition: rule.condition || '',
        action: rule.action || '',
        priority: Number(rule.priority || 50),
        is_active: true,
        parsed_metadata: rule
      });
      createdRules.push(created);
    }

    const traitUpdates = {};
    for (const trait of traitsToApply) {
      const key = String(trait?.name || '').trim().toLowerCase();
      const field = TRAIT_FIELD_MAP[key];
      if (!field) continue;
      traitUpdates[field] = clampStat(Number(trait?.value || 0), 0, 100);
    }

    if (Object.keys(traitUpdates).length > 0) {
      await base44.asServiceRole.entities.Companion.update(companionId, traitUpdates);
    }

    return Response.json({
      success: true,
      parsed: {
        traits: traitsToApply,
        memories: parsedMemories,
        rules: parsedRules
      },
      applied: {
        memories_created: createdMemories.length,
        rules_created: createdRules.length,
        traits_applied: Object.keys(traitUpdates).length
      },
      limits
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});