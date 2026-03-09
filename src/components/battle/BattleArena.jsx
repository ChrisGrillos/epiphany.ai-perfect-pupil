import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { 
  Swords, 
  Shield, 
  Zap, 
  Activity,
  TrendingUp,
  Settings,
  Play,
  Pause
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  applySignaturePassive, applyBondBoosts, traitWeightedAutoMove 
} from './TraitBattleEngine';

const ALIGNMENT_COLORS = {
  guardian: 'bg-blue-100 text-blue-700 border-blue-300',
  rogue: 'bg-red-100 text-red-700 border-red-300',
  cipher: 'bg-purple-100 text-purple-700 border-purple-300'
};

const ELEMENT_COLORS = {
  heat: 'bg-orange-500',
  tide: 'bg-blue-500',
  gale: 'bg-cyan-400',
  stone: 'bg-amber-700',
  volt: 'bg-yellow-400',
  vine: 'bg-green-500',
  lumen: 'bg-white',
  umber: 'bg-slate-800'
};

const STATUS_ICONS = {
  jammed: '🎯',
  cracked: '🛡️',
  snared: '🐌',
  marked: '🎯',
  drained: '🩸',
  rot: '☠️',
  stunned: '⚡',
  aegis: '✨'
};

export default function BattleArena({ 
  battle, 
  teamA: rawTeamA, 
  teamB: rawTeamB, 
  isPlayerTeamA = true,
  onTakeTurn,
  onEndBattle,
  companion
}) {
  // Phase 4: Apply bond boosts and signature passives
  const bondLevel = companion?.bond_level || 0;
  const teamA = applyBondBoosts(
    rawTeamA.map(u => applySignaturePassive(u, companion, rawTeamA, rawTeamB)),
    isPlayerTeamA ? bondLevel : 0
  );
  const teamB = applyBondBoosts(
    rawTeamB.map(u => u),
    isPlayerTeamA ? 0 : bondLevel
  );
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedMove, setSelectedMove] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [autoBattle, setAutoBattle] = useState(false);
  const [battleLog, setBattleLog] = useState([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  
  const currentQueue = battle?.initiative_queue || [];
  const currentUnit = currentQueue[currentTurnIndex];
  const isPlayerTurn = isPlayerTeamA 
    ? teamA.some(u => u.id === currentUnit?.unit_id)
    : teamB.some(u => u.id === currentUnit?.unit_id);
  
  useEffect(() => {
    if (autoBattle && isPlayerTurn) {
      executeAutoTurn();
    }
  }, [currentTurnIndex, autoBattle, isPlayerTurn]);
  
  const executeAutoTurn = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const unit = [...teamA, ...teamB].find(u => u.id === currentUnit?.unit_id);
    if (!unit) return;
    
    // Phase 4: Use trait-weighted AI if companion has traits
    const isMyUnit = isPlayerTeamA 
      ? teamA.some(u => u.id === currentUnit?.unit_id)
      : teamB.some(u => u.id === currentUnit?.unit_id);
    
    let autoDecision;
    if (isMyUnit && companion?.trait_affinity) {
      const allies = isPlayerTeamA ? teamA : teamB;
      const enemies = isPlayerTeamA ? teamB : teamA;
      autoDecision = traitWeightedAutoMove(unit, allies, enemies, companion);
    }
    
    if (!autoDecision) {
      autoDecision = calculateAutoMove(unit, teamA, teamB, isPlayerTeamA);
    }
    
    handleTakeTurn(autoDecision.move, autoDecision.target);
  };
  
  const calculateAutoMove = (unit, teamA, teamB, isTeamA) => {
    const profile = unit.tactics_profile || 'balanced';
    const allies = isTeamA ? teamA : teamB;
    const enemies = isTeamA ? teamB : teamA;
    const availableMoves = unit.moveset.filter(m => m.current_cooldown === 0);
    
    // Priority 1: Secure KO
    for (const enemy of enemies) {
      for (const move of availableMoves) {
        const estimatedDamage = calculateDamage(unit, enemy, move);
        if (estimatedDamage >= enemy.combat_stats.hp) {
          return { move, target: enemy };
        }
      }
    }
    
    // Priority 2: Prevent death
    if (unit.combat_stats.hp < unit.combat_stats.max_hp * 0.3) {
      const guardMove = availableMoves.find(m => m.taxonomy === 'guard');
      if (guardMove) return { move: guardMove, target: unit };
      
      const healMove = availableMoves.find(m => m.taxonomy === 'boost' && m.move_name.includes('Heal'));
      if (healMove) return { move: healMove, target: unit };
    }
    
    // Priority 3: Exploit advantage
    const advantageTargets = enemies.filter(e => hasAdvantage(unit, e));
    if (advantageTargets.length > 0) {
      const bestMove = availableMoves.filter(m => m.taxonomy === 'smash' || m.taxonomy === 'blast')[0];
      return { move: bestMove || availableMoves[0], target: advantageTargets[0] };
    }
    
    // Priority 4: Apply control (based on profile)
    if (profile === 'control') {
      const controlMove = availableMoves.find(m => m.taxonomy === 'trick');
      if (controlMove) {
        const highThreat = enemies.reduce((a, b) => 
          (a.combat_stats.power > b.combat_stats.power ? a : b)
        );
        return { move: controlMove, target: highThreat };
      }
    }
    
    // Priority 5: Best DPS skill
    const damageMove = availableMoves.filter(m => 
      m.taxonomy === 'smash' || m.taxonomy === 'blast'
    ).sort((a, b) => b.damage - a.damage)[0];
    
    if (damageMove) {
      const lowestHpEnemy = enemies.reduce((a, b) => 
        a.combat_stats.hp < b.combat_stats.hp ? a : b
      );
      return { move: damageMove, target: lowestHpEnemy };
    }
    
    // Default: Basic strike on weakest
    const strikeMove = availableMoves.find(m => m.move_type === 'strike');
    const weakest = enemies.reduce((a, b) => 
      a.combat_stats.hp < b.combat_stats.hp ? a : b
    );
    return { move: strikeMove || availableMoves[0], target: weakest };
  };
  
  const calculateDamage = (attacker, defender, move) => {
    let baseDamage = attacker.combat_stats.power * (move.power_mult || 1);
    
    // Alignment advantage
    if (hasAlignmentAdvantage(attacker.alignment, defender.alignment)) {
      baseDamage *= 1.25;
    } else if (hasAlignmentAdvantage(defender.alignment, attacker.alignment)) {
      baseDamage *= 0.8;
    }
    
    // Element advantage
    if (hasElementAdvantage(attacker.element, defender.element)) {
      baseDamage *= 1.15;
    }
    
    // Guard reduction
    const reduction = defender.combat_stats.guard * 0.5;
    const finalDamage = Math.max(1, baseDamage - reduction);
    
    return Math.round(finalDamage);
  };
  
  const hasAdvantage = (attacker, defender) => {
    return hasAlignmentAdvantage(attacker.alignment, defender.alignment) ||
           hasElementAdvantage(attacker.element, defender.element);
  };
  
  const hasAlignmentAdvantage = (attacker, defender) => {
    const advantages = {
      guardian: 'rogue',
      rogue: 'cipher',
      cipher: 'guardian'
    };
    return advantages[attacker] === defender;
  };
  
  const hasElementAdvantage = (attacker, defender) => {
    const wheel = {
      heat: 'vine',
      vine: 'tide',
      tide: 'heat',
      volt: 'gale',
      gale: 'stone',
      stone: 'volt',
      lumen: 'umber',
      umber: 'lumen'
    };
    return wheel[attacker] === defender;
  };
  
  const handleTakeTurn = async (move, target) => {
    const damage = calculateDamage(
      [...teamA, ...teamB].find(u => u.id === currentUnit.unit_id),
      target,
      move
    );
    
    const turnData = {
      unit_id: currentUnit.unit_id,
      move_id: move.move_id,
      target_id: target.id,
      damage,
      timestamp: new Date().toISOString()
    };
    
    await onTakeTurn(turnData);
    
    setBattleLog(prev => [
      ...prev,
      `${currentUnit.name} used ${move.move_name} on ${target.name} for ${damage} damage!`
    ]);
    
    setCurrentTurnIndex(prev => (prev + 1) % currentQueue.length);
    setSelectedUnit(null);
    setSelectedMove(null);
    setSelectedTarget(null);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-4">
      {/* Battle Header */}
      <Card className="mb-4 bg-slate-800/50 border-violet-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Swords className="w-6 h-6 text-violet-400" />
              <div>
                <h2 className="text-lg font-bold text-white">
                  Round {battle.current_round}
                </h2>
                <p className="text-sm text-violet-300">{battle.battle_type}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">Auto-Battle</span>
                <Switch
                  checked={autoBattle}
                  onCheckedChange={setAutoBattle}
                />
              </div>
              {currentUnit && (
                <Badge className="bg-violet-600 text-white">
                  {currentUnit.name}'s Turn
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Battle Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Team A */}
        <Card className="bg-blue-900/30 border-blue-500">
          <CardContent className="p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Your Team
            </h3>
            <div className="space-y-3">
              {teamA.map(unit => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  isAlly={true}
                  isActive={currentUnit?.unit_id === unit.id}
                  onSelect={() => !autoBattle && setSelectedUnit(unit)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Battle Log */}
        <Card className="bg-slate-800/50 border-violet-500">
          <CardContent className="p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-400" />
              Battle Log
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {battleLog.slice(-10).reverse().map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-violet-200 p-2 bg-slate-700/50 rounded"
                >
                  {log}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Team B */}
        <Card className="bg-red-900/30 border-red-500">
          <CardContent className="p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-400" />
              Enemy Team
            </h3>
            <div className="space-y-3">
              {teamB.map(unit => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  isAlly={false}
                  isActive={currentUnit?.unit_id === unit.id}
                  isTargetable={!autoBattle && selectedMove}
                  onSelect={() => selectedMove && setSelectedTarget(unit)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Action Panel */}
      {!autoBattle && isPlayerTurn && selectedUnit && (
        <Card className="bg-slate-800/80 border-violet-500">
          <CardContent className="p-4">
            <h3 className="text-white font-bold mb-3">
              Choose Action for {selectedUnit.name}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {selectedUnit.moveset.map(move => (
                <Button
                  key={move.move_id}
                  onClick={() => setSelectedMove(move)}
                  disabled={move.current_cooldown > 0}
                  className={`
                    ${selectedMove?.move_id === move.move_id ? 'bg-violet-600' : 'bg-slate-700'}
                    hover:bg-violet-500 text-white
                  `}
                >
                  <div className="text-left w-full">
                    <div className="font-medium">{move.move_name}</div>
                    <div className="text-xs opacity-75">{move.taxonomy}</div>
                    {move.current_cooldown > 0 && (
                      <div className="text-xs text-red-400">CD: {move.current_cooldown}</div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UnitCard({ unit, isAlly, isActive, isTargetable, onSelect }) {
  const hpPercent = (unit.combat_stats.hp / unit.combat_stats.max_hp) * 100;
  
  return (
    <motion.div
      whileHover={isTargetable ? { scale: 1.02 } : {}}
      onClick={onSelect}
      className={`
        p-3 rounded-xl border-2 cursor-pointer transition-all
        ${isActive ? 'border-yellow-400 bg-yellow-900/20' : 'border-slate-600'}
        ${isTargetable ? 'hover:border-red-400' : ''}
        ${isAlly ? 'bg-blue-900/20' : 'bg-red-900/20'}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-white font-semibold text-sm">{unit.name}</h4>
          <div className="flex gap-1 mt-1">
            <Badge className={`${ALIGNMENT_COLORS[unit.alignment]} text-xs px-1 py-0`}>
              {unit.alignment}
            </Badge>
            <div className={`w-4 h-4 rounded-full ${ELEMENT_COLORS[unit.element]}`} 
                 title={unit.element} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-violet-300">Spd {unit.combat_stats.speed}</div>
          <div className="text-xs text-emerald-300">Pwr {unit.combat_stats.power}</div>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white">
          <span>HP</span>
          <span>{unit.combat_stats.hp}/{unit.combat_stats.max_hp}</span>
        </div>
        <Progress value={hpPercent} className="h-2" />
      </div>
      
      {unit.active_statuses && unit.active_statuses.length > 0 && (
        <div className="flex gap-1 mt-2">
          {unit.active_statuses.map((s, i) => (
            <span key={i} className="text-lg" title={s.status}>
              {STATUS_ICONS[s.status]}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}