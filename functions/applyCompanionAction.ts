import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Server-authoritative care action handler.
 * Accepts: { companion_id, action_type }
 * action_type: "feed" | "exercise" | "study" | "interact" | "play"
 * Returns: { companion, stat_changes, response_text, xp_awarded }
 */

const ACTION_CONFIG = {
  feed: {
    stat_changes: { hunger: 15, happiness: 5, trust_level: 2 },
    xp: 5,
    cooldown_field: 'last_fed',
    cooldown_minutes: 5,
    responses: [
      "{name} happily munches on the treat!",
      "Yummy! {name} loves it!",
      "{name}'s tummy is happy now!"
    ]
  },
  exercise: {
    stat_changes: { fitness: 10, happiness: 8, personality_energy: 3 },
    stat_costs: { hunger: 10 },
    xp: 8,
    cooldown_field: 'last_exercised',
    cooldown_minutes: 10,
    responses: [
      "{name} bounces around energetically!",
      "What a workout! {name} is getting stronger!",
      "{name} loves playtime!"
    ]
  },
  study: {
    stat_changes: { knowledge_level: 5, happiness: 3, personality_curiosity: 2 },
    xp: 10,
    cooldown_field: 'last_interaction',
    cooldown_minutes: 5,
    responses: [
      "{name} learned something new today!",
      "{name}'s curiosity is growing!",
      "Knowledge is power! {name} is getting smarter!"
    ]
  },
  interact: {
    stat_changes: { happiness: 10, trust_level: 5, affection_level: 3, personality_empathy: 2 },
    xp: 6,
    cooldown_field: 'last_interaction',
    cooldown_minutes: 3,
    responses: [
      "{name} feels so loved!",
      "Your bond with {name} grows stronger!",
      "{name} appreciates the attention!"
    ]
  },
  play: {
    stat_changes: { happiness: 12, fitness: 5, personality_energy: 4, personality_openness: 2 },
    stat_costs: { hunger: 5 },
    xp: 7,
    cooldown_field: 'last_interaction',
    cooldown_minutes: 5,
    responses: [
      "{name} is having so much fun!",
      "Playtime is the best time for {name}!",
      "{name} giggles with joy!"
    ]
  }
};

function clampStat(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function calculateMood(companion) {
  const avg = (companion.hunger + companion.happiness + companion.fitness) / 3;
  if (avg >= 80) return 'joyful';
  if (avg >= 60) return 'content';
  if (avg >= 40) return 'neutral';
  if (companion.hunger < 30) return 'tired';
  if (companion.happiness < 30) return 'sad';
  return 'neutral';
}

function calculateLevel(xp) {
  // Simple level curve: level = floor(sqrt(xp / 10)) + 1
  return Math.floor(Math.sqrt(xp / 10)) + 1;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companion_id, action_type } = await req.json();

    if (!companion_id || !action_type) {
      return Response.json({ error: 'Missing companion_id or action_type' }, { status: 400 });
    }

    const config = ACTION_CONFIG[action_type];
    if (!config) {
      return Response.json({ error: `Invalid action_type: ${action_type}` }, { status: 400 });
    }

    // Fetch companion (user-scoped for security)
    const companions = await base44.entities.Companion.filter({ id: companion_id });
    if (!companions || companions.length === 0) {
      return Response.json({ error: 'Companion not found' }, { status: 404 });
    }
    const companion = companions[0];

    // Check cooldown
    if (config.cooldown_field && companion[config.cooldown_field]) {
      const lastAction = new Date(companion[config.cooldown_field]);
      const now = new Date();
      const diffMinutes = (now - lastAction) / 60000;
      if (diffMinutes < config.cooldown_minutes) {
        const remaining = Math.ceil(config.cooldown_minutes - diffMinutes);
        return Response.json({
          error: `Action on cooldown. Try again in ${remaining} minute(s).`,
          cooldown_remaining: remaining
        }, { status: 429 });
      }
    }

    // Calculate stat changes
    const appliedChanges = {};
    const now = new Date().toISOString();

    // Apply stat increases
    for (const [stat, delta] of Object.entries(config.stat_changes)) {
      const current = companion[stat] || 0;
      const newVal = clampStat(current + delta);
      appliedChanges[stat] = newVal;
    }

    // Apply stat costs (decreases)
    if (config.stat_costs) {
      for (const [stat, cost] of Object.entries(config.stat_costs)) {
        const current = appliedChanges[stat] !== undefined ? appliedChanges[stat] : (companion[stat] || 0);
        appliedChanges[stat] = clampStat(current - cost);
      }
    }

    // XP and level
    const newXP = (companion.experience_points || 0) + config.xp;
    appliedChanges.experience_points = newXP;
    appliedChanges.level = calculateLevel(newXP);

    // Mood
    const projectedCompanion = { ...companion, ...appliedChanges };
    appliedChanges.mood = calculateMood(projectedCompanion);

    // Timestamps
    if (config.cooldown_field) {
      appliedChanges[config.cooldown_field] = now;
    }
    appliedChanges.last_interaction = now;
    appliedChanges.total_care_actions = (companion.total_care_actions || 0) + 1;

    // Pick response
    const responses = config.responses;
    const responseText = responses[Math.floor(Math.random() * responses.length)].replace('{name}', companion.name);

    // Commit updates
    await base44.entities.Companion.update(companion_id, appliedChanges);

    // Log the interaction
    await base44.entities.InteractionLog.create({
      companion_id,
      action_type,
      stat_changes: appliedChanges,
      companion_response: responseText,
      xp_awarded: config.xp,
      source: 'care'
    });

    return Response.json({
      companion: { ...companion, ...appliedChanges },
      stat_changes: appliedChanges,
      response_text: responseText,
      xp_awarded: config.xp
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});