import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Server-authoritative battle finalization.
 * Called after battle status = 'completed' to distribute rewards.
 * Accepts: { battle_id }
 * Returns: { result, xp_awards, pcp_awards }
 */

const XP_CONFIG = {
  win: 50,
  lose: 15,
  draw: 25,
  participation: 10,
  ko_bonus: 10
};

const PCP_CONFIG = {
  training_win: 5,
  pvp_win_base: 20,
  pvp_lose: 0
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { battle_id } = await req.json();

    if (!battle_id) {
      return Response.json({ error: 'Missing battle_id' }, { status: 400 });
    }

    // Fetch battle
    const battles = await base44.entities.Battle.filter({ id: battle_id });
    if (!battles || battles.length === 0) {
      return Response.json({ error: 'Battle not found' }, { status: 404 });
    }
    const battle = battles[0];

    if (battle.status !== 'completed') {
      return Response.json({ error: 'Battle is not completed' }, { status: 400 });
    }

    // Check if already finalized
    const existingResults = await base44.entities.BattleResult.filter({ battle_id });
    if (existingResults && existingResults.length > 0 && existingResults[0].rewards_distributed) {
      return Response.json({ error: 'Rewards already distributed', result: existingResults[0] }, { status: 409 });
    }

    // Fetch turn data for stats
    const turns = await base44.entities.BattleTurn.filter({ battle_id });

    // Calculate team summaries
    const teamASummary = { total_damage_dealt: 0, total_damage_taken: 0, total_healing: 0, kos_scored: 0, kos_suffered: 0, mvp_roster_id: null };
    const teamBSummary = { total_damage_dealt: 0, total_damage_taken: 0, total_healing: 0, kos_scored: 0, kos_suffered: 0, mvp_roster_id: null };

    const damageByUnit = {};

    for (const turn of turns) {
      const summary = turn.actor_team === 'team_a' ? teamASummary : teamBSummary;
      const oppSummary = turn.actor_team === 'team_a' ? teamBSummary : teamASummary;

      summary.total_damage_dealt += turn.damage_dealt || 0;
      oppSummary.total_damage_taken += turn.damage_dealt || 0;
      summary.total_healing += turn.healing_done || 0;

      if (turn.ko_triggered) {
        summary.kos_scored += 1;
        oppSummary.kos_suffered += 1;
      }

      // Track per-unit damage for MVP
      if (!damageByUnit[turn.actor_roster_id]) damageByUnit[turn.actor_roster_id] = { damage: 0, team: turn.actor_team };
      damageByUnit[turn.actor_roster_id].damage += turn.damage_dealt || 0;
    }

    // Determine MVPs
    let mvpA = null, mvpADmg = 0, mvpB = null, mvpBDmg = 0;
    for (const [id, data] of Object.entries(damageByUnit)) {
      if (data.team === 'team_a' && data.damage > mvpADmg) { mvpA = id; mvpADmg = data.damage; }
      if (data.team === 'team_b' && data.damage > mvpBDmg) { mvpB = id; mvpBDmg = data.damage; }
    }
    teamASummary.mvp_roster_id = mvpA;
    teamBSummary.mvp_roster_id = mvpB;

    // Calculate XP awards
    const xpAwards = {};
    const allIds = [...(battle.team_a || []), ...(battle.team_b || [])];

    for (const id of allIds) {
      const isTeamA = (battle.team_a || []).includes(id);
      const team = isTeamA ? 'team_a' : 'team_b';
      let xp = XP_CONFIG.participation;

      if (battle.winner === 'draw') {
        xp += XP_CONFIG.draw;
      } else if (battle.winner === team) {
        xp += XP_CONFIG.win;
      } else {
        xp += XP_CONFIG.lose;
      }

      // KO bonus
      const unitKOs = turns.filter(t => t.actor_roster_id === id && t.ko_triggered).length;
      xp += unitKOs * XP_CONFIG.ko_bonus;

      xpAwards[id] = xp;
    }

    // Calculate PcP awards
    const pcpAwards = {};
    const isTraining = battle.battle_type === 'training_ai';

    if (isTraining) {
      pcpAwards[battle.owner_a] = battle.winner === 'team_a' ? PCP_CONFIG.training_win : 0;
    } else {
      const betAmount = battle.pcp_bet || 0;
      if (battle.winner === 'draw') {
        // Return bets
        pcpAwards[battle.owner_a] = betAmount;
        pcpAwards[battle.owner_b] = betAmount;
      } else if (battle.winner === 'team_a') {
        pcpAwards[battle.owner_a] = PCP_CONFIG.pvp_win_base + betAmount * 2;
        pcpAwards[battle.owner_b] = PCP_CONFIG.pvp_lose;
      } else {
        pcpAwards[battle.owner_a] = PCP_CONFIG.pvp_lose;
        pcpAwards[battle.owner_b] = PCP_CONFIG.pvp_win_base + betAmount * 2;
      }
    }

    // Calculate duration
    const startTime = battle.started_at ? new Date(battle.started_at) : new Date();
    const endTime = battle.completed_at ? new Date(battle.completed_at) : new Date();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // Create BattleResult
    const result = await base44.entities.BattleResult.create({
      battle_id,
      winner: battle.winner,
      total_rounds: battle.current_round,
      duration_seconds: durationSeconds,
      team_a_summary: teamASummary,
      team_b_summary: teamBSummary,
      xp_awards: xpAwards,
      pcp_awards: pcpAwards,
      rewards_distributed: true
    });

    // Distribute XP to roster units and update win/loss records
    for (const [rosterId, xp] of Object.entries(xpAwards)) {
      // Skip system AI units
      if ((battle.team_b || []).includes(rosterId) && battle.owner_b === 'system') continue;

      const units = await base44.asServiceRole.entities.PupilRoster.filter({ id: rosterId });
      if (units && units.length > 0) {
        const unit = units[0];
        const isTeamA = (battle.team_a || []).includes(rosterId);
        const team = isTeamA ? 'team_a' : 'team_b';
        const won = battle.winner === team;
        const drew = battle.winner === 'draw';

        await base44.asServiceRole.entities.PupilRoster.update(rosterId, {
          total_xp: (unit.total_xp || 0) + xp,
          total_battles: (unit.total_battles || 0) + 1,
          wins: (unit.wins || 0) + (won ? 1 : 0),
          losses: (unit.losses || 0) + (!won && !drew ? 1 : 0),
          draws: (unit.draws || 0) + (drew ? 1 : 0),
          combat_stats: { ...unit.combat_stats, hp: unit.combat_stats.max_hp },
          active_statuses: [],
          is_fainted: false
        });
      }
    }

    // Distribute PcP to users
    for (const [userId, pcp] of Object.entries(pcpAwards)) {
      if (userId === 'system' || pcp <= 0) continue;
      const currencies = await base44.asServiceRole.entities.UserCurrency.filter({ created_by: userId });
      if (currencies && currencies.length > 0) {
        await base44.asServiceRole.entities.UserCurrency.update(currencies[0].id, {
          pcp_balance: (currencies[0].pcp_balance || 0) + pcp,
          pcp_earned: (currencies[0].pcp_earned || 0) + pcp,
          pcp_won: (currencies[0].pcp_won || 0) + pcp
        });
      }
    }

    // Log battle interaction for companion AND update trait_affinity + bond + combat stats
    if (battle.owner_a && battle.owner_a !== 'system') {
      for (const rosterId of (battle.team_a || [])) {
        const units = await base44.asServiceRole.entities.PupilRoster.filter({ id: rosterId });
        if (units && units.length > 0 && units[0].companion_id && units[0].companion_id !== 'system') {
          const companionId = units[0].companion_id;

          await base44.asServiceRole.entities.InteractionLog.create({
            companion_id: companionId,
            action_type: 'battle',
            details: { battle_id, winner: battle.winner, xp: xpAwards[rosterId] || 0 },
            xp_awarded: xpAwards[rosterId] || 0,
            pcp_awarded: pcpAwards[battle.owner_a] || 0,
            source: 'battle'
          });

          // Update companion trait_affinity, bond, and combat performance
          const companions = await base44.asServiceRole.entities.Companion.filter({ id: companionId });
          if (companions && companions.length > 0) {
            const comp = companions[0];
            const aff = comp.trait_affinity || { aggressive: 0, nurturing: 0, curious: 0, chaotic: 0, disciplined: 0 };

            // Battle increases aggressive + disciplined
            aff.aggressive = (aff.aggressive || 0) + 2;
            aff.disciplined = (aff.disciplined || 0) + 1;

            // Aggregate this unit's combat stats from turns
            const unitTurns = turns.filter(t => t.actor_roster_id === rosterId);
            const dmgDealt = unitTurns.reduce((s, t) => s + (t.damage_dealt || 0), 0);
            const healDone = unitTurns.reduce((s, t) => s + (t.healing_done || 0), 0);
            const statusCount = unitTurns.reduce((s, t) => s + (t.statuses_applied?.length || 0), 0);

            await base44.asServiceRole.entities.Companion.update(companionId, {
              trait_affinity: aff,
              bond_level: Math.min(100, (comp.bond_level || 0) + 3),
              combat_damage_dealt: (comp.combat_damage_dealt || 0) + dmgDealt,
              combat_healing_done: (comp.combat_healing_done || 0) + healDone,
              combat_status_inflicted: (comp.combat_status_inflicted || 0) + statusCount
            });
          }
        }
      }
    }

    return Response.json({
      result,
      xp_awards: xpAwards,
      pcp_awards: pcpAwards
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});