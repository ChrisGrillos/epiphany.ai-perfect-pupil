import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Server-authoritative evolution attempt handler.
 * Accepts: { companion_id, puzzle_id }
 * Returns: { success, from_stage, to_stage, stat_changes, pcp_reward }
 */

const EVOLUTION_PATH = ['infant', 'child', 'teenager', 'adult'];

const STAGE_XP_REQUIREMENTS = {
  infant: 0,
  child: 100,
  teenager: 500,
  adult: 2000
};

const EVOLUTION_STAT_BONUSES = {
  child: { knowledge_level: 5, personality_curiosity: 5, happiness: 10 },
  teenager: { knowledge_level: 10, fitness: 5, personality_openness: 5, personality_energy: 5 },
  adult: { knowledge_level: 15, fitness: 10, personality_empathy: 10, trust_level: 10 }
};

const PCP_REWARDS = {
  child: 10,
  teenager: 25,
  adult: 50
};

function clampStat(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companion_id, puzzle_id } = await req.json();

    if (!companion_id) {
      return Response.json({ error: 'Missing companion_id' }, { status: 400 });
    }

    // Fetch companion
    const companions = await base44.entities.Companion.filter({ id: companion_id });
    if (!companions || companions.length === 0) {
      return Response.json({ error: 'Companion not found' }, { status: 404 });
    }
    const companion = companions[0];

    // Determine next stage
    const currentIndex = EVOLUTION_PATH.indexOf(companion.stage);
    if (currentIndex === -1 || currentIndex >= EVOLUTION_PATH.length - 1) {
      return Response.json({ error: 'Companion is already at maximum stage' }, { status: 400 });
    }

    const nextStage = EVOLUTION_PATH[currentIndex + 1];
    const requiredXP = STAGE_XP_REQUIREMENTS[nextStage];

    // Check XP requirement
    if ((companion.experience_points || 0) < requiredXP) {
      // Log failed attempt
      await base44.entities.EvolutionAttempt.create({
        companion_id,
        puzzle_id: puzzle_id || null,
        from_stage: companion.stage,
        to_stage: nextStage,
        success: false,
        failure_reason: `Insufficient XP. Need ${requiredXP}, have ${companion.experience_points || 0}.`,
        xp_cost: 0,
        pcp_reward: 0
      });

      return Response.json({
        success: false,
        from_stage: companion.stage,
        to_stage: nextStage,
        reason: `Need ${requiredXP} XP to evolve. Current: ${companion.experience_points || 0}.`
      });
    }

    // Check puzzle completion if provided
    if (puzzle_id) {
      const puzzles = await base44.entities.EvolutionPuzzle.filter({ id: puzzle_id });
      if (puzzles && puzzles.length > 0 && !puzzles[0].completed) {
        return Response.json({
          success: false,
          reason: 'Puzzle must be completed before evolution.'
        });
      }
    }

    // Apply evolution
    const statBonuses = EVOLUTION_STAT_BONUSES[nextStage] || {};
    const statChanges = {};
    for (const [stat, bonus] of Object.entries(statBonuses)) {
      statChanges[stat] = clampStat((companion[stat] || 0) + bonus);
    }
    statChanges.stage = nextStage;

    // Update trait_affinity on evolution (reward disciplined trait for reaching milestones)
    const currentAffinity = companion.trait_affinity || { aggressive: 0, nurturing: 0, curious: 0, chaotic: 0, disciplined: 0 };
    const evolutionAffinityBonus = { disciplined: 5, curious: 3 };
    const newAffinity = { ...currentAffinity };
    for (const [trait, delta] of Object.entries(evolutionAffinityBonus)) {
      newAffinity[trait] = (newAffinity[trait] || 0) + delta;
    }
    statChanges.trait_affinity = newAffinity;

    // Bond increases on evolution
    statChanges.bond_level = Math.min(100, (companion.bond_level || 0) + 10);

    const pcpReward = PCP_REWARDS[nextStage] || 0;

    // Update companion
    await base44.entities.Companion.update(companion_id, statChanges);

    // Award PcP
    if (pcpReward > 0) {
      const currencies = await base44.entities.UserCurrency.filter({});
      if (currencies && currencies.length > 0) {
        await base44.entities.UserCurrency.update(currencies[0].id, {
          pcp_balance: (currencies[0].pcp_balance || 0) + pcpReward,
          pcp_earned: (currencies[0].pcp_earned || 0) + pcpReward
        });
      }
    }

    // Log successful attempt
    await base44.entities.EvolutionAttempt.create({
      companion_id,
      puzzle_id: puzzle_id || null,
      from_stage: companion.stage,
      to_stage: nextStage,
      success: true,
      stat_changes: statChanges,
      xp_cost: 0,
      pcp_reward: pcpReward
    });

    // Log interaction
    await base44.entities.InteractionLog.create({
      companion_id,
      action_type: 'puzzle',
      details: { from_stage: companion.stage, to_stage: nextStage },
      stat_changes: statChanges,
      companion_response: `${companion.name} evolved to ${nextStage}!`,
      xp_awarded: 0,
      pcp_awarded: pcpReward,
      source: 'evolution'
    });

    return Response.json({
      success: true,
      from_stage: companion.stage,
      to_stage: nextStage,
      stat_changes: statChanges,
      pcp_reward: pcpReward,
      companion: { ...companion, ...statChanges }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});