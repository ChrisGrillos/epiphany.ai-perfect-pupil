import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Server-authoritative battle round resolver.
 * Accepts: { battle_id, actions }
 * actions: [{ roster_id, action_type: "move"|"swap"|"skip", move_id?, target_roster_ids? }]
 * Returns: { turns, round_summary, battle_status, next_initiative }
 */

// Alignment triangle: Guardian > Rogue > Cipher > Guardian
const ALIGNMENT_ADVANTAGE = {
  guardian: 'rogue',
  rogue: 'cipher',
  cipher: 'guardian'
};

// Element chart (simple advantage pairs)
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

function hasAlignmentAdvantage(attacker, defender) {
  return ALIGNMENT_ADVANTAGE[attacker] === defender;
}

function hasElementAdvantage(moveElement, defenderElement) {
  return ELEMENT_ADVANTAGE[moveElement] === defenderElement;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function resolveAction(actor, targets, action, allUnits, seed) {
  const result = {
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
    result.narration = `${actor.creature_name || actor.creature_template} skips their turn.`;
    // Snapshot HP
    for (const u of allUnits) {
      result.hp_snapshot[u.id] = u.combat_stats.hp;
    }
    return result;
  }

  if (action.action_type !== 'move' || !action.move_id) {
    result.narration = `${actor.creature_name || actor.creature_template} does nothing.`;
    for (const u of allUnits) {
      result.hp_snapshot[u.id] = u.combat_stats.hp;
    }
    return result;
  }

  // Find the move
  const move = (actor.moveset || []).find(m => m.move_id === action.move_id);
  if (!move) {
    result.narration = `${actor.creature_name || actor.creature_template} tries an unknown move!`;
    result.is_miss = true;
    for (const u of allUnits) {
      result.hp_snapshot[u.id] = u.combat_stats.hp;
    }
    return result;
  }

  // Check cooldown
  if ((move.current_cooldown || 0) > 0) {
    result.narration = `${move.move_name} is still cooling down!`;
    result.is_miss = true;
    for (const u of allUnits) {
      result.hp_snapshot[u.id] = u.combat_stats.hp;
    }
    return result;
  }

  // Process each target
  for (const targetId of (action.target_roster_ids || [])) {
    const target = allUnits.find(u => u.id === targetId);
    if (!target || target.combat_stats.hp <= 0) continue;

    // Accuracy check
    const accuracyRoll = ((seed * 9301 + 49297) % 233280) / 233280 * 100;
    if (accuracyRoll > (move.accuracy || 100)) {
      result.is_miss = true;
      result.narration = `${actor.creature_name || actor.creature_template} uses ${move.move_name} but misses!`;
      continue;
    }

    if (move.taxonomy === 'guard' || move.taxonomy === 'boost') {
      // Defensive/buff moves
      if (move.taxonomy === 'guard') {
        result.statuses_applied.push({
          status: 'aegis',
          target_id: actor.id,
          duration: 2
        });
        actor.active_statuses = actor.active_statuses || [];
        actor.active_statuses.push({ status: 'aegis', duration: 2, source_id: actor.id });
        result.narration = `${actor.creature_name || actor.creature_template} raises a protective barrier!`;
      } else {
        result.narration = `${actor.creature_name || actor.creature_template} powers up!`;
      }
    } else {
      // Damage calculation
      let baseDamage = move.power || 10;
      const attackStat = actor.combat_stats.power || 10;
      const defenseStat = target.combat_stats.guard || 10;

      // Alignment triangle
      if (hasAlignmentAdvantage(actor.alignment, target.alignment)) {
        baseDamage = Math.floor(baseDamage * 1.25);
        result.triangle_bonus = true;
      }

      // Element advantage
      if (move.element && hasElementAdvantage(move.element, target.element)) {
        baseDamage = Math.floor(baseDamage * 1.3);
        result.element_bonus = true;
      }

      // Critical hit (10% base chance, +focus bonus)
      const critChance = 10 + (actor.combat_stats.focus || 0) * 0.5;
      const critRoll = ((seed * 7 + 13) % 100);
      if (critRoll < critChance) {
        baseDamage = Math.floor(baseDamage * 1.5);
        result.is_critical = true;
      }

      // Final damage = baseDamage * (attack / (attack + defense))
      const rawDamage = Math.floor(baseDamage * (attackStat / (attackStat + defenseStat)));
      const finalDamage = Math.max(1, rawDamage);

      // Aegis check
      const hasAegis = (target.active_statuses || []).some(s => s.status === 'aegis');
      const mitigated = hasAegis ? Math.floor(finalDamage * 0.5) : 0;
      const actualDamage = finalDamage - mitigated;

      target.combat_stats.hp = clamp(target.combat_stats.hp - actualDamage, 0, target.combat_stats.max_hp);
      result.damage_dealt += actualDamage;
      result.damage_resisted += mitigated;

      // Check KO
      if (target.combat_stats.hp <= 0) {
        result.ko_triggered = true;
        target.is_fainted = true;
      }

      // Status effects from move taxonomy
      if (move.taxonomy === 'trick') {
        const statusOptions = ['snared', 'marked'];
        const picked = statusOptions[seed % statusOptions.length];
        result.statuses_applied.push({ status: picked, target_id: targetId, duration: 2 });
        target.active_statuses = target.active_statuses || [];
        target.active_statuses.push({ status: picked, duration: 2, source_id: actor.id });
      }

      result.narration = `${actor.creature_name || actor.creature_template} uses ${move.move_name}${result.is_critical ? ' (CRITICAL!)' : ''} dealing ${actualDamage} damage to ${target.creature_name || target.creature_template}!${result.ko_triggered ? ' KO!' : ''}`;
    }
  }

  // Set cooldown on the used move
  move.current_cooldown = move.cooldown || 0;

  // Snapshot HP
  for (const u of allUnits) {
    result.hp_snapshot[u.id] = u.combat_stats.hp;
  }

  return result;
}

function tickStatusEffects(units) {
  for (const unit of units) {
    if (!unit.active_statuses) continue;
    unit.active_statuses = unit.active_statuses
      .map(s => ({ ...s, duration: s.duration - 1 }))
      .filter(s => s.duration > 0);
  }
}

function tickCooldowns(units) {
  for (const unit of units) {
    if (!unit.moveset) continue;
    for (const move of unit.moveset) {
      if (move.current_cooldown > 0) {
        move.current_cooldown -= 1;
      }
    }
  }
}

function checkBattleEnd(allUnits) {
  const teamAAlive = allUnits.filter(u => u._team === 'team_a' && u.combat_stats.hp > 0);
  const teamBAlive = allUnits.filter(u => u._team === 'team_b' && u.combat_stats.hp > 0);

  if (teamAAlive.length === 0 && teamBAlive.length === 0) return 'draw';
  if (teamAAlive.length === 0) return 'team_b';
  if (teamBAlive.length === 0) return 'team_a';
  return null;
}

function generateAutoAction(unit, enemies) {
  const aliveEnemies = enemies.filter(e => e.combat_stats.hp > 0);
  if (aliveEnemies.length === 0) return { roster_id: unit.id, action_type: 'skip' };

  // Pick the first available (non-cooldown) damage move
  const availableMoves = (unit.moveset || []).filter(m =>
    (m.current_cooldown || 0) === 0 && m.taxonomy !== 'guard' && m.taxonomy !== 'boost'
  );

  if (availableMoves.length === 0) {
    return { roster_id: unit.id, action_type: 'skip' };
  }

  // Target lowest HP enemy
  const target = aliveEnemies.reduce((a, b) => a.combat_stats.hp < b.combat_stats.hp ? a : b);

  const tactics = unit.tactics_profile || 'balanced';
  let move;
  if (tactics === 'aggressive') {
    move = availableMoves.reduce((a, b) => (b.power || 0) > (a.power || 0) ? b : a);
  } else {
    move = availableMoves[0];
  }

  return {
    roster_id: unit.id,
    action_type: 'move',
    move_id: move.move_id,
    target_roster_ids: [target.id]
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { battle_id, actions } = await req.json();

    if (!battle_id) {
      return Response.json({ error: 'Missing battle_id' }, { status: 400 });
    }

    // Fetch battle
    const battles = await base44.entities.Battle.filter({ id: battle_id });
    if (!battles || battles.length === 0) {
      return Response.json({ error: 'Battle not found' }, { status: 404 });
    }
    const battle = battles[0];

    if (battle.status !== 'in_progress') {
      return Response.json({ error: 'Battle is not in progress' }, { status: 400 });
    }

    // Fetch all roster units
    const allIds = [...(battle.team_a || []), ...(battle.team_b || [])];
    const allUnits = [];
    for (const id of allIds) {
      const units = await base44.asServiceRole.entities.PupilRoster.filter({ id });
      if (units && units.length > 0) {
        const unit = units[0];
        unit._team = (battle.team_a || []).includes(id) ? 'team_a' : 'team_b';
        allUnits.push(unit);
      }
    }

    // Build complete actions list (merge player actions + AI auto-actions)
    const playerActionMap = {};
    for (const a of (actions || [])) {
      playerActionMap[a.roster_id] = a;
    }

    const queue = battle.initiative_queue || [];
    const turnResults = [];
    let turnIndex = 0;
    let seed = battle.seed || 42;

    for (const slot of queue) {
      const unit = allUnits.find(u => u.id === slot.roster_id);
      if (!unit || unit.combat_stats.hp <= 0) continue;

      // Determine action
      let action = playerActionMap[slot.roster_id];
      if (!action) {
        // Auto-battle: generate action for AI or auto-enabled units
        const enemies = allUnits.filter(u => u._team !== unit._team);
        action = generateAutoAction(unit, enemies);
      }

      // Advance seed for determinism
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;

      const turnResult = resolveAction(unit, allUnits, action, allUnits, seed);
      turnResult.round_number = battle.current_round;
      turnResult.turn_index = turnIndex;
      turnResults.push(turnResult);

      // Persist turn record
      await base44.entities.BattleTurn.create({
        battle_id,
        round_number: battle.current_round,
        turn_index: turnIndex,
        ...turnResult
      });

      turnIndex++;

      // Check if battle should end after this action
      const winner = checkBattleEnd(allUnits);
      if (winner) {
        // Finalize battle
        await base44.entities.Battle.update(battle_id, {
          status: 'completed',
          winner,
          current_round: battle.current_round,
          completed_at: new Date().toISOString()
        });

        return Response.json({
          turns: turnResults,
          battle_status: 'completed',
          winner,
          round: battle.current_round,
          hp_snapshot: turnResult.hp_snapshot
        });
      }
    }

    // End-of-round: tick statuses & cooldowns
    tickStatusEffects(allUnits);
    tickCooldowns(allUnits);

    // Check max rounds
    const nextRound = battle.current_round + 1;
    if (nextRound > (battle.max_rounds || 20)) {
      await base44.entities.Battle.update(battle_id, {
        status: 'completed',
        winner: 'draw',
        current_round: battle.current_round,
        completed_at: new Date().toISOString()
      });

      return Response.json({
        turns: turnResults,
        battle_status: 'completed',
        winner: 'draw',
        round: battle.current_round
      });
    }

    // Rebuild initiative for next round
    const nextQueue = allUnits
      .filter(u => u.combat_stats.hp > 0)
      .map(u => ({ roster_id: u.id, team: u._team, speed: u.combat_stats.speed || 10, name: u.creature_name || u.creature_template }))
      .sort((a, b) => b.speed !== a.speed ? b.speed - a.speed : Math.random() - 0.5);

    // Update battle state
    await base44.entities.Battle.update(battle_id, {
      current_round: nextRound,
      initiative_queue: nextQueue
    });

    // Update roster units with current HP/statuses
    for (const unit of allUnits) {
      await base44.asServiceRole.entities.PupilRoster.update(unit.id, {
        combat_stats: unit.combat_stats,
        active_statuses: unit.active_statuses || [],
        moveset: unit.moveset,
        is_fainted: unit.combat_stats.hp <= 0
      });
    }

    return Response.json({
      turns: turnResults,
      battle_status: 'in_progress',
      round: nextRound,
      next_initiative: nextQueue,
      hp_snapshot: turnResults.length > 0 ? turnResults[turnResults.length - 1].hp_snapshot : {}
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});