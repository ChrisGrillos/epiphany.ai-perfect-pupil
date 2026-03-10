import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildUserOwnerKeys,
  getUserCurrencyRecord,
  ownerMatches,
  recomputeCompanionIdentity
} from './_serverUtils.ts';

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

async function cleanupTemporaryAi(base44: any, battle: any): Promise<void> {
  if (battle.battle_type !== 'training_ai') return;
  for (const rosterId of battle.team_b || []) {
    try {
      await base44.asServiceRole.entities.PupilRoster.delete(rosterId);
    } catch {
      // Non-fatal cleanup.
    }
  }
}

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

    const battles = await base44.asServiceRole.entities.Battle.filter({ id: battle_id });
    if (!battles || battles.length === 0) {
      return Response.json({ error: 'Battle not found' }, { status: 404 });
    }
    const battle = battles[0];

    const ownerKeys = buildUserOwnerKeys(user);
    const isParticipant = ownerMatches(battle.owner_a, ownerKeys) || ownerMatches(battle.owner_b, ownerKeys);
    if (!isParticipant) {
      return Response.json({ error: 'Forbidden: caller is not a battle participant' }, { status: 403 });
    }

    if (battle.status !== 'completed') {
      return Response.json({ error: 'Battle is not completed' }, { status: 400 });
    }

    const existingResults = await base44.asServiceRole.entities.BattleResult.filter({ battle_id });
    if (existingResults && existingResults.length > 0) {
      const existing = existingResults[0];
      return Response.json({
        result: existing,
        xp_awards: existing.xp_awards || {},
        pcp_awards: existing.pcp_awards || {},
        already_finalized: true
      });
    }

    const turns = await base44.asServiceRole.entities.BattleTurn.filter({ battle_id });

    const teamASummary = { total_damage_dealt: 0, total_damage_taken: 0, total_healing: 0, kos_scored: 0, kos_suffered: 0, mvp_roster_id: null };
    const teamBSummary = { total_damage_dealt: 0, total_damage_taken: 0, total_healing: 0, kos_scored: 0, kos_suffered: 0, mvp_roster_id: null };
    const damageByUnit: Record<string, { damage: number; team: string }> = {};

    for (const turn of turns || []) {
      const summary = turn.actor_team === 'team_a' ? teamASummary : teamBSummary;
      const oppSummary = turn.actor_team === 'team_a' ? teamBSummary : teamASummary;

      summary.total_damage_dealt += Number(turn.damage_dealt || 0);
      oppSummary.total_damage_taken += Number(turn.damage_dealt || 0);
      summary.total_healing += Number(turn.healing_done || 0);

      if (turn.ko_triggered) {
        summary.kos_scored += 1;
        oppSummary.kos_suffered += 1;
      }

      if (!damageByUnit[turn.actor_roster_id]) {
        damageByUnit[turn.actor_roster_id] = { damage: 0, team: turn.actor_team };
      }
      damageByUnit[turn.actor_roster_id].damage += Number(turn.damage_dealt || 0);
    }

    let mvpA = null, mvpADmg = -1, mvpB = null, mvpBDmg = -1;
    for (const [id, data] of Object.entries(damageByUnit)) {
      if (data.team === 'team_a' && data.damage > mvpADmg) {
        mvpA = id;
        mvpADmg = data.damage;
      }
      if (data.team === 'team_b' && data.damage > mvpBDmg) {
        mvpB = id;
        mvpBDmg = data.damage;
      }
    }
    teamASummary.mvp_roster_id = mvpA;
    teamBSummary.mvp_roster_id = mvpB;

    const xpAwards: Record<string, number> = {};
    const allIds = [...(battle.team_a || []), ...(battle.team_b || [])].map((id: any) => String(id));

    for (const rosterId of allIds) {
      const isTeamA = (battle.team_a || []).map((id: any) => String(id)).includes(rosterId);
      const team = isTeamA ? 'team_a' : 'team_b';
      let xp = XP_CONFIG.participation;

      if (battle.winner === 'draw') xp += XP_CONFIG.draw;
      else if (battle.winner === team) xp += XP_CONFIG.win;
      else xp += XP_CONFIG.lose;

      const unitKOs = (turns || []).filter((t: any) => t.actor_roster_id === rosterId && t.ko_triggered).length;
      xp += unitKOs * XP_CONFIG.ko_bonus;
      xpAwards[rosterId] = xp;
    }

    // Safe payout model:
    // - training_ai: fixed reward to owner_a on win.
    // - pvp: fixed base reward only; pcp_bet is ignored unless explicit escrow fields exist.
    const pcpAwards: Record<string, number> = {};
    const ownerA = String(battle.owner_a || '');
    const ownerB = String(battle.owner_b || '');
    const isTraining = battle.battle_type === 'training_ai';

    if (isTraining) {
      if (ownerA && battle.winner === 'team_a') {
        pcpAwards[ownerA] = PCP_CONFIG.training_win;
      }
    } else {
      const escrowA = Number(battle.pcp_escrow_a || 0);
      const escrowB = Number(battle.pcp_escrow_b || 0);
      const escrowPool = escrowA + escrowB;

      if (battle.winner === 'team_a') {
        if (ownerA) pcpAwards[ownerA] = PCP_CONFIG.pvp_win_base + escrowPool;
        if (ownerB) pcpAwards[ownerB] = PCP_CONFIG.pvp_lose;
      } else if (battle.winner === 'team_b') {
        if (ownerA) pcpAwards[ownerA] = PCP_CONFIG.pvp_lose;
        if (ownerB) pcpAwards[ownerB] = PCP_CONFIG.pvp_win_base + escrowPool;
      } else if (battle.winner === 'draw') {
        if (ownerA) pcpAwards[ownerA] = escrowA;
        if (ownerB) pcpAwards[ownerB] = escrowB;
      }
    }

    const startTime = battle.started_at ? new Date(battle.started_at) : new Date();
    const endTime = battle.completed_at ? new Date(battle.completed_at) : new Date();
    const durationSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

    const result = await base44.asServiceRole.entities.BattleResult.create({
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

    for (const [rosterId, xp] of Object.entries(xpAwards)) {
      if ((battle.team_b || []).map((id: any) => String(id)).includes(rosterId) && ownerB === 'system') continue;

      const units = await base44.asServiceRole.entities.PupilRoster.filter({ id: rosterId });
      if (!units || units.length === 0) continue;
      const unit = units[0];
      const isTeamA = (battle.team_a || []).map((id: any) => String(id)).includes(rosterId);
      const team = isTeamA ? 'team_a' : 'team_b';
      const won = battle.winner === team;
      const drew = battle.winner === 'draw';

      await base44.asServiceRole.entities.PupilRoster.update(rosterId, {
        total_xp: Number(unit.total_xp || 0) + Number(xp || 0),
        total_battles: Number(unit.total_battles || 0) + 1,
        wins: Number(unit.wins || 0) + (won ? 1 : 0),
        losses: Number(unit.losses || 0) + (!won && !drew ? 1 : 0),
        draws: Number(unit.draws || 0) + (drew ? 1 : 0),
        combat_stats: { ...unit.combat_stats, hp: unit.combat_stats?.max_hp || unit.combat_stats?.hp || 0 },
        active_statuses: [],
        is_fainted: false
      });
    }

    for (const [ownerKey, pcp] of Object.entries(pcpAwards)) {
      if (!ownerKey || ownerKey === 'system' || Number(pcp || 0) <= 0) continue;
      const currency = await getUserCurrencyRecord(base44, [ownerKey]);
      if (!currency) continue;

      await base44.asServiceRole.entities.UserCurrency.update(currency.id, {
        pcp_balance: Number(currency.pcp_balance || 0) + Number(pcp || 0),
        pcp_earned: Number(currency.pcp_earned || 0) + Number(pcp || 0),
        pcp_won: Number(currency.pcp_won || 0) + Number(pcp || 0)
      });
    }

    for (const rosterId of battle.team_a || []) {
      const units = await base44.asServiceRole.entities.PupilRoster.filter({ id: rosterId });
      if (!units || units.length === 0 || !units[0].companion_id || units[0].companion_id === 'system') continue;

      const companionId = units[0].companion_id;
      const unitTurns = (turns || []).filter((t: any) => t.actor_roster_id === rosterId);
      const dmgDealt = unitTurns.reduce((sum: number, t: any) => sum + Number(t.damage_dealt || 0), 0);
      const healDone = unitTurns.reduce((sum: number, t: any) => sum + Number(t.healing_done || 0), 0);
      const statusCount = unitTurns.reduce((sum: number, t: any) => sum + Number(t.statuses_applied?.length || 0), 0);

      await base44.asServiceRole.entities.InteractionLog.create({
        companion_id: companionId,
        action_type: 'battle',
        details: { battle_id, winner: battle.winner, xp: xpAwards[String(rosterId)] || 0 },
        xp_awarded: xpAwards[String(rosterId)] || 0,
        pcp_awarded: pcpAwards[String(ownerA)] || 0,
        source: 'battle'
      });

      const companions = await base44.asServiceRole.entities.Companion.filter({ id: companionId });
      if (!companions || companions.length === 0) continue;

      const comp = companions[0];
      const baseAffinity = comp.trait_affinity || {};
      const nextAffinity = {
        ...baseAffinity,
        aggressive: Number(baseAffinity.aggressive || 0) + 2,
        disciplined: Number(baseAffinity.disciplined || 0) + 1
      };
      const companionChanges: Record<string, any> = {
        trait_affinity: nextAffinity,
        bond_level: Math.min(100, Number(comp.bond_level || 0) + 3),
        combat_damage_dealt: Number(comp.combat_damage_dealt || 0) + dmgDealt,
        combat_healing_done: Number(comp.combat_healing_done || 0) + healDone,
        combat_status_inflicted: Number(comp.combat_status_inflicted || 0) + statusCount
      };
      Object.assign(
        companionChanges,
        recomputeCompanionIdentity(
          { ...comp, ...companionChanges },
          { recomputedAt: new Date().toISOString() }
        )
      );

      await base44.asServiceRole.entities.Companion.update(companionId, companionChanges);
    }

    await cleanupTemporaryAi(base44, battle);

    return Response.json({
      result,
      xp_awards: xpAwards,
      pcp_awards: pcpAwards
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
