import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import {
  buildDeterministicInitiativeQueue,
  buildUserOwnerKeys,
  nextSeed,
  ownerMatches,
  seededFloat01
} from './_serverUtils.ts';

/**
 * Server-authoritative battle round resolver.
 * Accepts: { battle_id, actions }
 * actions: [{ roster_id, action_type: "move"|"swap"|"skip", move_id?, target_roster_ids? }]
 * Returns: { turns, battle_status, next_initiative?, team_a_state, team_b_state, accepted_actions, rejected_actions }
 */

const ALIGNMENT_ADVANTAGE = {
  guardian: 'rogue',
  rogue: 'cipher',
  cipher: 'guardian'
};

const ELEMENT_ADVANTAGE = {
  heat: 'vine',
  vine: 'tide',
  tide: 'heat',
  gale: 'stone',
  stone: 'volt',
  volt: 'gale',
  lumen: 'umber',
  umber: 'lumen'
};

function hasAlignmentAdvantage(attacker: string, defender: string): boolean {
  return ALIGNMENT_ADVANTAGE[attacker as keyof typeof ALIGNMENT_ADVANTAGE] === defender;
}

function hasElementAdvantage(moveElement: string, defenderElement: string): boolean {
  return ELEMENT_ADVANTAGE[moveElement as keyof typeof ELEMENT_ADVANTAGE] === defenderElement;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getAliveEnemies(actor: any, allUnits: any[]): any[] {
  return allUnits.filter(u => u._team !== actor._team && Number(u?.combat_stats?.hp || 0) > 0);
}

function normalizeRosterIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(v => String(v || '').trim())
    .filter(Boolean);
}

function validateActionContract(rawAction: any, index: number): string | null {
  if (!rawAction || typeof rawAction !== 'object') {
    return `actions[${index}] must be an object`;
  }

  const rosterId = String(rawAction.roster_id || '').trim();
  if (!rosterId) {
    return `actions[${index}].roster_id is required`;
  }

  const actionType = String(rawAction.action_type || '').toLowerCase();
  if (!['move', 'skip', 'swap'].includes(actionType)) {
    return `actions[${index}].action_type must be one of move|skip|swap`;
  }

  if (actionType === 'move') {
    const moveId = String(rawAction.move_id || '').trim();
    if (!moveId) {
      return `actions[${index}].move_id is required for move actions`;
    }
    if (!Array.isArray(rawAction.target_roster_ids)) {
      return `actions[${index}].target_roster_ids must be an array for move actions`;
    }
  }

  return null;
}

function sanitizePlayerAction(actor: any, rawAction: any, allUnits: any[]): any {
  if (!rawAction || typeof rawAction !== 'object') {
    return null;
  }

  const actionType = String(rawAction.action_type || 'skip').toLowerCase();
  if (actionType === 'skip') {
    return { roster_id: actor.id, action_type: 'skip' };
  }

  if (actionType !== 'move') {
    return { roster_id: actor.id, action_type: 'skip' };
  }

  const moveId = String(rawAction.move_id || '').trim();
  if (!moveId) {
    return { roster_id: actor.id, action_type: 'skip' };
  }

  const move = (actor.moveset || []).find((m: any) => m.move_id === moveId);
  if (!move || Number(move.current_cooldown || 0) > 0) {
    return { roster_id: actor.id, action_type: 'skip' };
  }

  const enemies = getAliveEnemies(actor, allUnits);
  if (enemies.length === 0) {
    return { roster_id: actor.id, action_type: 'skip' };
  }

  const enemyIdSet = new Set(enemies.map(e => String(e.id)));
  let targetIds = normalizeRosterIds(rawAction.target_roster_ids).filter(id => enemyIdSet.has(id));

  if (targetIds.length === 0) {
    const defaultTarget = [...enemies].sort((a, b) =>
      Number(a.combat_stats.hp || 0) - Number(b.combat_stats.hp || 0)
    )[0];
    targetIds = [String(defaultTarget.id)];
  }

  return {
    roster_id: actor.id,
    action_type: 'move',
    move_id: moveId,
    target_roster_ids: targetIds.slice(0, 3)
  };
}

function generateAutoAction(unit: any, allUnits: any[]): any {
  const aliveEnemies = getAliveEnemies(unit, allUnits);
  if (aliveEnemies.length === 0) return { roster_id: unit.id, action_type: 'skip' };

  const availableMoves = (unit.moveset || []).filter((m: any) =>
    Number(m.current_cooldown || 0) === 0 && m.taxonomy !== 'guard' && m.taxonomy !== 'boost'
  );

  if (availableMoves.length === 0) {
    return { roster_id: unit.id, action_type: 'skip' };
  }

  const target = [...aliveEnemies].sort((a, b) =>
    Number(a.combat_stats.hp || 0) - Number(b.combat_stats.hp || 0)
  )[0];

  const tactics = unit.tactics_profile || 'balanced';
  let move = availableMoves[0];
  if (tactics === 'aggressive') {
    move = availableMoves.reduce((best: any, curr: any) => (Number(curr.power || 0) > Number(best.power || 0) ? curr : best), move);
  }

  return {
    roster_id: unit.id,
    action_type: 'move',
    move_id: move.move_id,
    target_roster_ids: [target.id]
  };
}

function snapshotHp(allUnits: any[]): Record<string, number> {
  const hpSnapshot: Record<string, number> = {};
  for (const u of allUnits) {
    hpSnapshot[u.id] = Number(u?.combat_stats?.hp || 0);
  }
  return hpSnapshot;
}

function resolveAction(actor: any, action: any, allUnits: any[], seed: number): { turnResult: any; seed: number } {
  const turnResult: any = {
    actor_roster_id: actor.id,
    actor_team: actor._team,
    action_type: action.action_type,
    move_id: action.move_id || null,
    target_roster_ids: action.target_roster_ids || [],
    damage_dealt: 0,
    damage_resisted: 0,
    healing_done: 0,
    statuses_applied: [],
    statuses_removed: [],
    is_critical: false,
    is_miss: false,
    triangle_bonus: false,
    element_bonus: false,
    ko_triggered: false,
    hp_snapshot: {},
    narration: ''
  };

  if (action.action_type === 'skip') {
    turnResult.narration = `${actor.creature_name || actor.creature_template} skips their turn.`;
    turnResult.hp_snapshot = snapshotHp(allUnits);
    return { turnResult, seed };
  }

  const move = (actor.moveset || []).find((m: any) => m.move_id === action.move_id);
  if (!move) {
    turnResult.narration = `${actor.creature_name || actor.creature_template} does nothing.`;
    turnResult.is_miss = true;
    turnResult.hp_snapshot = snapshotHp(allUnits);
    return { turnResult, seed };
  }

  if (Number(move.current_cooldown || 0) > 0) {
    turnResult.narration = `${move.move_name} is still cooling down!`;
    turnResult.is_miss = true;
    turnResult.hp_snapshot = snapshotHp(allUnits);
    return { turnResult, seed };
  }

  let anyTargetHit = false;
  for (const targetId of normalizeRosterIds(action.target_roster_ids)) {
    const target = allUnits.find(u => String(u.id) === targetId);
    if (!target || Number(target?.combat_stats?.hp || 0) <= 0 || target._team === actor._team) continue;

    seed = nextSeed(seed);
    const accuracyRoll = seededFloat01(seed) * 100;
    if (accuracyRoll > Number(move.accuracy || 100)) {
      turnResult.is_miss = true;
      turnResult.narration = `${actor.creature_name || actor.creature_template} uses ${move.move_name} but misses!`;
      continue;
    }

    anyTargetHit = true;

    if (move.taxonomy === 'guard' || move.taxonomy === 'boost') {
      if (move.taxonomy === 'guard') {
        turnResult.statuses_applied.push({
          status: 'aegis',
          target_id: actor.id,
          duration: 2
        });
        actor.active_statuses = actor.active_statuses || [];
        actor.active_statuses.push({ status: 'aegis', duration: 2, source_id: actor.id });
        turnResult.narration = `${actor.creature_name || actor.creature_template} raises a protective barrier!`;
      } else {
        turnResult.narration = `${actor.creature_name || actor.creature_template} powers up!`;
      }
      continue;
    }

    let baseDamage = Number(move.power || 10);
    const attackStat = Number(actor?.combat_stats?.power || 10);
    const defenseStat = Number(target?.combat_stats?.guard || 10);

    if (hasAlignmentAdvantage(String(actor.alignment || ''), String(target.alignment || ''))) {
      baseDamage = Math.floor(baseDamage * 1.25);
      turnResult.triangle_bonus = true;
    }

    if (move.element && hasElementAdvantage(String(move.element), String(target.element || ''))) {
      baseDamage = Math.floor(baseDamage * 1.3);
      turnResult.element_bonus = true;
    }

    seed = nextSeed(seed);
    const critChance = Math.min(95, 10 + Number(actor?.combat_stats?.focus || 0) * 0.5);
    const critRoll = seededFloat01(seed) * 100;
    if (critRoll < critChance) {
      baseDamage = Math.floor(baseDamage * 1.5);
      turnResult.is_critical = true;
    }

    const rawDamage = Math.floor(baseDamage * (attackStat / (attackStat + defenseStat)));
    const finalDamage = Math.max(1, rawDamage);

    const hasAegis = (target.active_statuses || []).some((s: any) => s.status === 'aegis');
    const mitigated = hasAegis ? Math.floor(finalDamage * 0.5) : 0;
    const actualDamage = finalDamage - mitigated;

    target.combat_stats.hp = clamp(Number(target.combat_stats.hp || 0) - actualDamage, 0, Number(target.combat_stats.max_hp || 0));
    turnResult.damage_dealt += actualDamage;
    turnResult.damage_resisted += mitigated;

    if (Number(target.combat_stats.hp || 0) <= 0) {
      turnResult.ko_triggered = true;
      target.is_fainted = true;
    }

    if (move.taxonomy === 'trick') {
      const statusOptions = ['snared', 'marked'];
      seed = nextSeed(seed);
      const picked = statusOptions[Math.floor(seededFloat01(seed) * statusOptions.length) % statusOptions.length];
      turnResult.statuses_applied.push({ status: picked, target_id: targetId, duration: 2 });
      target.active_statuses = target.active_statuses || [];
      target.active_statuses.push({ status: picked, duration: 2, source_id: actor.id });
    }

    turnResult.narration =
      `${actor.creature_name || actor.creature_template} uses ${move.move_name}` +
      `${turnResult.is_critical ? ' (CRITICAL!)' : ''} dealing ${actualDamage} damage to ` +
      `${target.creature_name || target.creature_template}!${turnResult.ko_triggered ? ' KO!' : ''}`;
  }

  move.current_cooldown = Number(move.cooldown || 0);
  if (!anyTargetHit && !turnResult.narration) {
    turnResult.narration = `${actor.creature_name || actor.creature_template} has no valid targets.`;
  }

  turnResult.hp_snapshot = snapshotHp(allUnits);
  return { turnResult, seed };
}

function tickStatusEffects(units: any[]): void {
  for (const unit of units) {
    if (!Array.isArray(unit.active_statuses)) continue;
    unit.active_statuses = unit.active_statuses
      .map((s: any) => ({ ...s, duration: Number(s.duration || 0) - 1 }))
      .filter((s: any) => Number(s.duration || 0) > 0);
  }
}

function tickCooldowns(units: any[]): void {
  for (const unit of units) {
    if (!Array.isArray(unit.moveset)) continue;
    for (const move of unit.moveset) {
      if (Number(move.current_cooldown || 0) > 0) {
        move.current_cooldown = Number(move.current_cooldown || 0) - 1;
      }
    }
  }
}

function checkBattleEnd(allUnits: any[]): string | null {
  const teamAAlive = allUnits.filter(u => u._team === 'team_a' && Number(u?.combat_stats?.hp || 0) > 0);
  const teamBAlive = allUnits.filter(u => u._team === 'team_b' && Number(u?.combat_stats?.hp || 0) > 0);

  if (teamAAlive.length === 0 && teamBAlive.length === 0) return 'draw';
  if (teamAAlive.length === 0) return 'team_b';
  if (teamBAlive.length === 0) return 'team_a';
  return null;
}

async function persistRosterState(base44: any, allUnits: any[]): Promise<void> {
  for (const unit of allUnits) {
    await base44.asServiceRole.entities.PupilRoster.update(unit.id, {
      combat_stats: unit.combat_stats,
      active_statuses: unit.active_statuses || [],
      moveset: unit.moveset,
      is_fainted: Number(unit?.combat_stats?.hp || 0) <= 0
    });
  }
}

function buildTeamState(allUnits: any[], team: 'team_a' | 'team_b'): any[] {
  return allUnits
    .filter(u => u._team === team)
    .map((u: any) => {
      const { _team, ...safe } = u;
      return safe;
    });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: any = null;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { battle_id, actions = [] } = payload || {};
    if (!battle_id) {
      return Response.json({ error: 'Missing battle_id' }, { status: 400 });
    }
    if (!Array.isArray(actions)) {
      return Response.json({ error: 'actions must be an array' }, { status: 400 });
    }

    const malformedActionErrors = actions
      .map((rawAction: any, index: number) => validateActionContract(rawAction, index))
      .filter(Boolean);
    if (malformedActionErrors.length > 0) {
      return Response.json(
        {
          error: 'Malformed actions payload',
          details: malformedActionErrors
        },
        { status: 400 }
      );
    }

    const battleRows = await base44.asServiceRole.entities.Battle.filter({ id: battle_id });
    if (!battleRows || battleRows.length === 0) {
      return Response.json({ error: 'Battle not found' }, { status: 404 });
    }
    const battle = battleRows[0];

    if (battle.status !== 'in_progress') {
      return Response.json({ error: 'Battle is not in progress' }, { status: 400 });
    }

    const ownerKeys = buildUserOwnerKeys(user);
    const callerTeams = new Set<string>();
    if (ownerMatches(battle.owner_a, ownerKeys)) callerTeams.add('team_a');
    if (ownerMatches(battle.owner_b, ownerKeys)) callerTeams.add('team_b');
    if (callerTeams.size === 0) {
      return Response.json({ error: 'Forbidden: caller is not a participant in this battle' }, { status: 403 });
    }

    const allIds = [...(battle.team_a || []), ...(battle.team_b || [])].map((id: any) => String(id));
    const allUnits: any[] = [];
    for (const id of allIds) {
      const unitRows = await base44.asServiceRole.entities.PupilRoster.filter({ id });
      if (unitRows && unitRows.length > 0) {
        const unit = unitRows[0];
        unit._team = (battle.team_a || []).map((x: any) => String(x)).includes(id) ? 'team_a' : 'team_b';
        allUnits.push(unit);
      }
    }

    const playerActionMap: Record<string, any> = {};
    const acceptedActions: any[] = [];
    const rejectedActions: any[] = [];
    for (const rawAction of actions) {
      const rosterId = String(rawAction?.roster_id || '');
      const actor = allUnits.find(u => String(u.id) === rosterId);
      if (!actor) {
        rejectedActions.push({ roster_id: rosterId, reason: 'roster_not_found_in_battle' });
        continue;
      }
      if (!callerTeams.has(actor._team)) {
        rejectedActions.push({ roster_id: rosterId, reason: 'actor_not_controlled_by_caller' });
        continue;
      }
      const sanitized = sanitizePlayerAction(actor, rawAction, allUnits);
      if (sanitized) {
        playerActionMap[rosterId] = sanitized;
        acceptedActions.push(sanitized);
      } else {
        rejectedActions.push({ roster_id: rosterId, reason: 'action_failed_sanitization' });
      }
    }

    const queue = Array.isArray(battle.initiative_queue) ? battle.initiative_queue : [];
    const turnResults: any[] = [];
    let turnIndex = 0;
    let seed = Number(battle.seed || 42) >>> 0;

    for (const slot of queue) {
      const unit = allUnits.find(u => String(u.id) === String(slot.roster_id));
      if (!unit || Number(unit?.combat_stats?.hp || 0) <= 0) continue;

      const unitKey = String(slot.roster_id);
      let action = playerActionMap[unitKey];
      if (!action) {
        action = generateAutoAction(unit, allUnits);
      }

      const resolved = resolveAction(unit, action, allUnits, seed);
      const turnResult = resolved.turnResult;
      seed = resolved.seed;

      turnResult.round_number = battle.current_round;
      turnResult.turn_index = turnIndex;
      turnResults.push(turnResult);

      await base44.asServiceRole.entities.BattleTurn.create({
        battle_id,
        round_number: battle.current_round,
        turn_index: turnIndex,
        ...turnResult
      });

      turnIndex += 1;

      const winner = checkBattleEnd(allUnits);
      if (winner) {
        await persistRosterState(base44, allUnits);
        await base44.asServiceRole.entities.Battle.update(battle_id, {
          status: 'completed',
          winner,
          current_round: battle.current_round,
          completed_at: new Date().toISOString(),
          seed
        });

        return Response.json({
          turns: turnResults,
          battle_status: 'completed',
          winner,
          round: battle.current_round,
          hp_snapshot: turnResult.hp_snapshot,
          accepted_actions: acceptedActions,
          rejected_actions: rejectedActions,
          team_a_state: buildTeamState(allUnits, 'team_a'),
          team_b_state: buildTeamState(allUnits, 'team_b')
        });
      }
    }

    tickStatusEffects(allUnits);
    tickCooldowns(allUnits);

    const nextRound = Number(battle.current_round || 1) + 1;
    const maxRounds = Number(battle.max_rounds || 20);

    if (nextRound > maxRounds) {
      await persistRosterState(base44, allUnits);
      await base44.asServiceRole.entities.Battle.update(battle_id, {
        status: 'completed',
        winner: 'draw',
        current_round: battle.current_round,
        completed_at: new Date().toISOString(),
        seed
      });

      return Response.json({
        turns: turnResults,
        battle_status: 'completed',
        winner: 'draw',
        round: battle.current_round,
        accepted_actions: acceptedActions,
        rejected_actions: rejectedActions,
        team_a_state: buildTeamState(allUnits, 'team_a'),
        team_b_state: buildTeamState(allUnits, 'team_b')
      });
    }

    const teamAUnits = allUnits.filter(u => u._team === 'team_a' && Number(u?.combat_stats?.hp || 0) > 0);
    const teamBUnits = allUnits.filter(u => u._team === 'team_b' && Number(u?.combat_stats?.hp || 0) > 0);
    const nextQueue = buildDeterministicInitiativeQueue(teamAUnits, teamBUnits, seed);

    await persistRosterState(base44, allUnits);
    await base44.asServiceRole.entities.Battle.update(battle_id, {
      current_round: nextRound,
      initiative_queue: nextQueue,
      seed
    });

    return Response.json({
      turns: turnResults,
      battle_status: 'in_progress',
      round: nextRound,
      next_initiative: nextQueue,
      hp_snapshot: turnResults.length > 0 ? turnResults[turnResults.length - 1].hp_snapshot : snapshotHp(allUnits),
      accepted_actions: acceptedActions,
      rejected_actions: rejectedActions,
      team_a_state: buildTeamState(allUnits, 'team_a'),
      team_b_state: buildTeamState(allUnits, 'team_b')
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
