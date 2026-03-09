import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Server-authoritative battle initialization.
 * Accepts: { battle_type, mode, team_a_ids, team_b_ids?, pcp_bet? }
 * For training_ai battles, team_b is auto-generated.
 * Returns: { battle, initiative_queue }
 */

const AI_TEMPLATES = {
  training_easy: {
    creature_template: 'training_dummy',
    chassis_family: 'golems',
    alignment: 'guardian',
    element: 'stone',
    combat_stats: { hp: 80, max_hp: 80, guard: 8, power: 6, speed: 5, focus: 5, will: 5 },
    moveset: [
      { move_id: 'basic_strike', move_name: 'Pummel', move_type: 'strike', taxonomy: 'smash', element: 'stone', power: 15, accuracy: 90, cooldown: 0 },
      { move_id: 'basic_guard', move_name: 'Brace', move_type: 'utility', taxonomy: 'guard', element: 'neutral', power: 0, accuracy: 100, cooldown: 2 }
    ]
  },
  training_medium: {
    creature_template: 'sparring_golem',
    chassis_family: 'golems',
    alignment: 'cipher',
    element: 'volt',
    combat_stats: { hp: 120, max_hp: 120, guard: 12, power: 10, speed: 8, focus: 8, will: 8 },
    moveset: [
      { move_id: 'volt_strike', move_name: 'Shock Slam', move_type: 'strike', taxonomy: 'smash', element: 'volt', power: 20, accuracy: 85, cooldown: 1 },
      { move_id: 'volt_blast', move_name: 'Arc Pulse', move_type: 'skill', taxonomy: 'blast', element: 'volt', power: 25, accuracy: 80, cooldown: 2 },
      { move_id: 'basic_guard', move_name: 'Iron Wall', move_type: 'utility', taxonomy: 'guard', element: 'neutral', power: 0, accuracy: 100, cooldown: 2 }
    ]
  }
};

function buildInitiativeQueue(teamAUnits, teamBUnits) {
  const allUnits = [
    ...teamAUnits.map(u => ({ roster_id: u.id || u._id, team: 'team_a', speed: u.combat_stats?.speed || 10, name: u.creature_name || u.creature_template })),
    ...teamBUnits.map(u => ({ roster_id: u.id || u._id, team: 'team_b', speed: u.combat_stats?.speed || 10, name: u.creature_name || u.creature_template }))
  ];
  // Sort by speed descending, tie-break randomly
  allUnits.sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    return Math.random() - 0.5;
  });
  return allUnits;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { battle_type, mode, team_a_ids, team_b_ids, pcp_bet } = await req.json();

    if (!battle_type || !mode || !team_a_ids || team_a_ids.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const expectedSize = mode === '1v1' ? 1 : 3;
    if (team_a_ids.length !== expectedSize) {
      return Response.json({ error: `${mode} requires exactly ${expectedSize} unit(s) per team` }, { status: 400 });
    }

    // Fetch team A roster units
    const teamAUnits = [];
    for (const id of team_a_ids) {
      const units = await base44.entities.PupilRoster.filter({ id });
      if (!units || units.length === 0) {
        return Response.json({ error: `Roster unit ${id} not found` }, { status: 404 });
      }
      teamAUnits.push(units[0]);
    }

    // Handle PcP bet validation
    let validatedBet = 0;
    if (pcp_bet && pcp_bet > 0 && battle_type !== 'training_ai') {
      const currencies = await base44.entities.UserCurrency.filter({});
      const userCurrency = currencies[0];
      if (!userCurrency || userCurrency.pcp_balance < pcp_bet) {
        return Response.json({ error: 'Insufficient PcP balance for bet' }, { status: 400 });
      }
      validatedBet = pcp_bet;
    }

    // Build team B
    let teamBUnits = [];
    let teamBIds = [];
    let ownerB = 'system';

    if (battle_type === 'training_ai') {
      // Generate AI opponents
      const difficulty = mode === '1v1' ? 'training_easy' : 'training_medium';
      const template = AI_TEMPLATES[difficulty];
      for (let i = 0; i < expectedSize; i++) {
        const aiUnit = await base44.asServiceRole.entities.PupilRoster.create({
          companion_id: 'system',
          creature_template: template.creature_template,
          creature_name: `${template.creature_template}_${i + 1}`,
          chassis_family: template.chassis_family,
          alignment: template.alignment,
          element: template.element,
          combat_stats: { ...template.combat_stats },
          moveset: template.moveset.map(m => ({ ...m, current_cooldown: 0 })),
          auto_battle_enabled: true,
          tactics_profile: 'balanced'
        });
        teamBUnits.push(aiUnit);
        teamBIds.push(aiUnit.id);
      }
    } else {
      // PvP — fetch team B roster
      if (!team_b_ids || team_b_ids.length !== expectedSize) {
        return Response.json({ error: `${mode} requires exactly ${expectedSize} unit(s) for team B` }, { status: 400 });
      }
      for (const id of team_b_ids) {
        const units = await base44.asServiceRole.entities.PupilRoster.filter({ id });
        if (!units || units.length === 0) {
          return Response.json({ error: `Roster unit ${id} not found` }, { status: 404 });
        }
        teamBUnits.push(units[0]);
      }
      teamBIds = team_b_ids;
      ownerB = teamBUnits[0]?.created_by || 'unknown';
    }

    // Build initiative queue
    const initiativeQueue = buildInitiativeQueue(teamAUnits, teamBUnits);

    // Create the battle record
    const seed = Math.floor(Math.random() * 1000000);
    const battle = await base44.entities.Battle.create({
      battle_type,
      mode,
      team_a: team_a_ids,
      team_b: teamBIds,
      owner_a: user.email,
      owner_b: ownerB,
      current_round: 1,
      initiative_queue: initiativeQueue,
      pcp_bet: validatedBet,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      seed
    });

    // Deduct PcP bet if applicable
    if (validatedBet > 0) {
      const currencies = await base44.entities.UserCurrency.filter({});
      if (currencies[0]) {
        await base44.entities.UserCurrency.update(currencies[0].id, {
          pcp_balance: currencies[0].pcp_balance - validatedBet,
          pcp_wagered: (currencies[0].pcp_wagered || 0) + validatedBet
        });
      }
    }

    return Response.json({
      battle,
      initiative_queue: initiativeQueue,
      team_a: teamAUnits,
      team_b: teamBUnits
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});