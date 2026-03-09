/**
 * Phase 4: Trait-Driven Battle AI Engine
 * Applies companion's evolution path, signature passives, 
 * bond level, and trait affinity to combat calculations.
 */

// Bond level bonuses applied to all allied units
export function getBondBonuses(bondLevel) {
  if (!bondLevel) return {};
  const tier = Math.floor(bondLevel / 25); // 0-3
  return {
    powerBonus: tier * 3,        // +0/3/6/9% power
    guardBonus: tier * 2,        // +0/2/4/6% guard  
    speedBonus: tier * 1,        // +0/1/2/3% speed
    critBonus: tier * 5,         // +0/5/10/15% crit chance
  };
}

// Signature passive effects applied per-unit during combat
export function applySignaturePassive(unit, companion, allAllies, allEnemies) {
  if (!companion?.signature_passive) return unit;

  const passive = companion.signature_passive;
  const stats = { ...unit.combat_stats };

  // Guardian passives
  if (passive.includes('Iron Wall')) {
    stats._damage_reduction = 0.15;
  }
  if (passive.includes('Vigilant Eye')) {
    stats._auto_counter = true;
  }
  if (passive.includes('Living Fortress')) {
    stats._regen_percent = 0.05;
  }

  // Predator passives
  if (passive.includes('Razor Instinct')) {
    stats._crit_bonus = 0.25;
  }
  if (passive.includes('Armor Break')) {
    stats._armor_shred = 0.10;
  }
  if (passive.includes('Predator Sense')) {
    stats._execute_bonus = 0.30;
    stats._execute_threshold = 0.40;
  }

  // Mystic passives
  if (passive.includes('Elemental Resonance')) {
    stats._elemental_bonus = 0.20;
  }
  if (passive.includes('Aura Weaver')) {
    stats._buff_extend = 1;
  }
  if (passive.includes('Foresight')) {
    stats._dodge_chance = 0.20;
  }

  // Scholar passives
  if (passive.includes('Triage')) {
    stats._heal_bonus = 0.25;
  }
  if (passive.includes('Battle Mind')) {
    stats.speed = Math.round(stats.speed * 1.10);
  }
  if (passive.includes('Wisdom')) {
    const knowledgeBonus = Math.floor((companion.knowledge_level || 0) / 20);
    stats.power += knowledgeBonus;
    stats.focus += knowledgeBonus;
  }

  // Trickster passives
  if (passive.includes('Shadow Step')) {
    stats._dodge_chance = (stats._dodge_chance || 0) + 0.30;
  }
  if (passive.includes('Wild Card')) {
    stats._random_buff = true;
  }
  if (passive.includes('Disruption')) {
    stats._jam_chance = 0.20;
  }

  // Adaptive passives
  if (passive.includes('Versatile')) {
    stats.hp = Math.round(stats.hp * 1.10);
    stats.max_hp = Math.round(stats.max_hp * 1.10);
    stats.power = Math.round(stats.power * 1.10);
    stats.guard = Math.round(stats.guard * 1.10);
    stats.speed = Math.round(stats.speed * 1.10);
  }
  if (passive.includes('Mirror')) {
    stats._mirror = true;
  }
  if (passive.includes('Synergy')) {
    stats._synergy_double = true;
  }

  return { ...unit, combat_stats: stats };
}

// Trait-driven AI decision weighting
export function getTraitWeights(companion) {
  const aff = companion?.trait_affinity || {};
  const total = Object.values(aff).reduce((s, v) => s + (v || 0), 0) || 1;

  return {
    aggression: (aff.aggressive || 0) / total,    // Prefer high damage moves
    nurture: (aff.nurturing || 0) / total,         // Prefer healing/support
    curiosity: (aff.curious || 0) / total,         // Prefer status/trick moves
    chaos: (aff.chaotic || 0) / total,             // More random choices
    discipline: (aff.disciplined || 0) / total,    // Prefer optimal plays
  };
}

// Enhanced auto-battle decision that factors in traits
export function traitWeightedAutoMove(unit, allies, enemies, companion) {
  const weights = getTraitWeights(companion);
  const availableMoves = (unit.moveset || []).filter(m => (m.current_cooldown || 0) === 0);
  if (availableMoves.length === 0) return null;

  // Score each move based on trait affinity
  const scoredMoves = availableMoves.map(move => {
    let score = 50; // baseline

    // Aggressive trait favors damage
    if (move.taxonomy === 'smash' || move.taxonomy === 'blast' || move.taxonomy === 'finisher') {
      score += weights.aggression * 100;
    }

    // Nurturing trait favors healing/guard
    if (move.taxonomy === 'guard' || move.taxonomy === 'boost') {
      score += weights.nurture * 100;
    }

    // Curious trait favors tricks/status
    if (move.taxonomy === 'trick' || move.taxonomy === 'counter') {
      score += weights.curiosity * 100;
    }

    // Chaotic trait adds randomness
    score += weights.chaos * (Math.random() * 80);

    // Discipline favors highest power moves
    if (weights.discipline > 0.3) {
      score += (move.power || 0) * weights.discipline * 5;
    }

    return { move, score };
  });

  // Sort by score and pick best
  scoredMoves.sort((a, b) => b.score - a.score);
  const chosen = scoredMoves[0].move;

  // Choose target
  let target;
  if (chosen.taxonomy === 'guard' || chosen.taxonomy === 'boost') {
    // Target self or weakest ally
    const weakestAlly = allies.reduce((a, b) => 
      (a.combat_stats?.hp || 0) < (b.combat_stats?.hp || 0) ? a : b
    );
    target = weakestAlly;
  } else {
    // Target weakest enemy (or random if chaotic)
    if (weights.chaos > 0.3) {
      target = enemies[Math.floor(Math.random() * enemies.length)];
    } else {
      target = enemies.reduce((a, b) => 
        (a.combat_stats?.hp || 0) < (b.combat_stats?.hp || 0) ? a : b
      );
    }
  }

  return { move: chosen, target };
}

// Apply bond-level stat boosts to entire team
export function applyBondBoosts(team, bondLevel) {
  const bonuses = getBondBonuses(bondLevel);
  return team.map(unit => {
    const stats = { ...unit.combat_stats };
    stats.power = Math.round(stats.power * (1 + bonuses.powerBonus / 100));
    stats.guard = Math.round(stats.guard * (1 + bonuses.guardBonus / 100));
    stats.speed = Math.round(stats.speed * (1 + bonuses.speedBonus / 100));
    stats._crit_bonus = (stats._crit_bonus || 0) + bonuses.critBonus / 100;
    return { ...unit, combat_stats: stats };
  });
}