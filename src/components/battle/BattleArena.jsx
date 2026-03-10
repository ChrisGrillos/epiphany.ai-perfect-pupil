import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Activity,
  Loader2,
  Shield,
  Swords
} from 'lucide-react';

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
  lumen: 'bg-white border border-slate-300',
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

function normalizeUnit(unit) {
  return {
    ...unit,
    name: unit?.name || unit?.creature_name || unit?.creature_template || 'Unknown Unit'
  };
}

export default function BattleArena({
  battle,
  teamA: rawTeamA,
  teamB: rawTeamB,
  isPlayerTeamA = true,
  onTakeTurn
}) {
  const teamA = useMemo(() => (rawTeamA || []).map(normalizeUnit), [rawTeamA]);
  const teamB = useMemo(() => (rawTeamB || []).map(normalizeUnit), [rawTeamB]);
  const allUnits = useMemo(() => [...teamA, ...teamB], [teamA, teamB]);

  const playerTeam = isPlayerTeamA ? teamA : teamB;
  const enemyTeam = isPlayerTeamA ? teamB : teamA;
  const currentQueue = battle?.initiative_queue || [];

  const [selectedMove, setSelectedMove] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [autoBattle, setAutoBattle] = useState(false);
  const [battleLog, setBattleLog] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const enemyAutoResolveRoundRef = useRef('');

  const actionableSlot = useMemo(
    () =>
      currentQueue.find(slot => {
        const unit = allUnits.find(u => u.id === slot?.roster_id);
        if (!unit) return false;
        const isPlayerUnit = playerTeam.some(p => p.id === unit.id);
        const alive = Number(unit.combat_stats?.hp || 0) > 0;
        return isPlayerUnit && alive;
      }),
    [currentQueue, allUnits, playerTeam]
  );

  const currentActor = allUnits.find(u => u.id === actionableSlot?.roster_id) || null;
  const isPlayerTurn = Boolean(currentActor);

  const appendNarration = (roundResult) => {
    const lines = (roundResult?.turns || []).map(t => t?.narration).filter(Boolean);
    if (lines.length > 0) {
      setBattleLog(prev => [...prev, ...lines]);
    }
  };

  useEffect(() => {
    if (!isPlayerTurn) {
      setSelectedMove(null);
      setSelectedTarget(null);
      return;
    }

    if (!selectedTarget || !enemyTeam.some(e => e.id === selectedTarget.id && Number(e.combat_stats?.hp || 0) > 0)) {
      const firstAliveEnemy = enemyTeam.find(e => Number(e.combat_stats?.hp || 0) > 0) || null;
      setSelectedTarget(firstAliveEnemy);
    }
  }, [isPlayerTurn, enemyTeam, selectedTarget]);

  useEffect(() => {
    if (!autoBattle || !isPlayerTurn || !currentActor || submitting) return;
    executeAutoTurn();
  }, [autoBattle, isPlayerTurn, currentActor, submitting]);

  useEffect(() => {
    if (isPlayerTurn || submitting) return;
    if (!battle?.id) return;

    const roundKey = `${battle.id}:${battle.current_round}`;
    if (enemyAutoResolveRoundRef.current === roundKey) return;
    enemyAutoResolveRoundRef.current = roundKey;

    resolveEnemyPhase();
  }, [isPlayerTurn, submitting, battle?.id, battle?.current_round]);

  const chooseAutoMove = (unit) => {
    const availableMoves = (unit.moveset || []).filter(m => Number(m.current_cooldown || 0) === 0);
    const aliveEnemies = enemyTeam.filter(e => Number(e.combat_stats?.hp || 0) > 0);
    if (availableMoves.length === 0 || aliveEnemies.length === 0) return null;

    const orderedMoves = [...availableMoves].sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
    const preferredMove =
      orderedMoves.find(m => !['guard', 'boost'].includes(String(m.taxonomy || '').toLowerCase())) || orderedMoves[0];

    const target = [...aliveEnemies].sort((a, b) => Number(a.combat_stats?.hp || 0) - Number(b.combat_stats?.hp || 0))[0];
    return { move: preferredMove, target };
  };

  const resolveEnemyPhase = async () => {
    setSubmitting(true);
    try {
      const roundResult = await onTakeTurn([]);
      appendNarration(roundResult);
    } finally {
      setSubmitting(false);
    }
  };

  const executeAutoTurn = async () => {
    if (!currentActor) return;
    await new Promise(resolve => setTimeout(resolve, 500));
    const picked = chooseAutoMove(currentActor);
    if (!picked) {
      await handleSkipTurn();
      return;
    }
    await handleTakeTurn(picked.move, picked.target);
  };

  const handleSkipTurn = async () => {
    if (!currentActor || submitting) return;
    setSubmitting(true);
    try {
      const roundResult = await onTakeTurn([
        {
          roster_id: currentActor.id,
          action_type: 'skip'
        }
      ]);
      appendNarration(roundResult);
      setSelectedMove(null);
      setSelectedTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTakeTurn = async (move, target) => {
    if (!currentActor || !move || !target || submitting) return;
    setSubmitting(true);
    try {
      const roundResult = await onTakeTurn([
        {
          roster_id: currentActor.id,
          action_type: 'move',
          move_id: move.move_id,
          target_roster_ids: [target.id]
        }
      ]);
      appendNarration(roundResult);
      setSelectedMove(null);
      setSelectedTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-4">
      <Card className="mb-4 bg-slate-800/50 border-violet-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Swords className="w-6 h-6 text-violet-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Round {battle.current_round}</h2>
                <p className="text-sm text-violet-300">{battle.battle_type}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">Auto-Battle</span>
                <Switch checked={autoBattle} onCheckedChange={setAutoBattle} disabled={submitting} />
              </div>
              <Badge className="bg-violet-600 text-white">
                {isPlayerTurn ? `${currentActor.name} ready` : 'Resolving enemy actions'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
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
                  isActive={currentActor?.id === unit.id}
                  isTargetable={false}
                  onSelect={() => {}}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-violet-500">
          <CardContent className="p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-400" />
              Battle Log
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {battleLog.slice(-12).reverse().map((log, i) => (
                <motion.div
                  key={`${log}-${i}`}
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
                  isActive={false}
                  isTargetable={Boolean(isPlayerTurn && selectedMove && Number(unit.combat_stats?.hp || 0) > 0)}
                  onSelect={() => {
                    if (isPlayerTurn && selectedMove && Number(unit.combat_stats?.hp || 0) > 0) {
                      setSelectedTarget(unit);
                    }
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {!autoBattle && isPlayerTurn && currentActor && (
        <Card className="bg-slate-800/80 border-violet-500">
          <CardContent className="p-4">
            <h3 className="text-white font-bold mb-3">Choose Action for {currentActor.name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(currentActor.moveset || []).map(move => (
                <Button
                  key={move.move_id}
                  onClick={() => setSelectedMove(move)}
                  disabled={Number(move.current_cooldown || 0) > 0 || submitting}
                  className={`${selectedMove?.move_id === move.move_id ? 'bg-violet-600' : 'bg-slate-700'} hover:bg-violet-500 text-white`}
                >
                  <div className="text-left w-full">
                    <div className="font-medium">{move.move_name}</div>
                    <div className="text-xs opacity-75">{move.taxonomy}</div>
                    {Number(move.current_cooldown || 0) > 0 && (
                      <div className="text-xs text-red-400">CD: {move.current_cooldown}</div>
                    )}
                  </div>
                </Button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="text-sm text-slate-300">
                Target: <span className="text-white font-semibold">{selectedTarget?.name || 'Choose enemy unit'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleSkipTurn} disabled={submitting}>
                  Skip Turn
                </Button>
                <Button
                  onClick={() => handleTakeTurn(selectedMove, selectedTarget)}
                  disabled={!selectedMove || !selectedTarget || submitting}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Confirm Turn
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UnitCard({ unit, isAlly, isActive, isTargetable, onSelect }) {
  const hp = Number(unit?.combat_stats?.hp || 0);
  const maxHp = Math.max(1, Number(unit?.combat_stats?.max_hp || 1));
  const hpPercent = (hp / maxHp) * 100;

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
            <div className={`w-4 h-4 rounded-full ${ELEMENT_COLORS[unit.element]}`} title={unit.element} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-violet-300">Spd {unit.combat_stats?.speed || 0}</div>
          <div className="text-xs text-emerald-300">Pwr {unit.combat_stats?.power || 0}</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white">
          <span>HP</span>
          <span>{hp}/{maxHp}</span>
        </div>
        <Progress value={hpPercent} className="h-2" />
      </div>

      {Array.isArray(unit.active_statuses) && unit.active_statuses.length > 0 && (
        <div className="flex gap-1 mt-2">
          {unit.active_statuses.map((s, i) => (
            <span key={`${unit.id}-status-${i}`} className="text-lg" title={s.status}>
              {STATUS_ICONS[s.status] || '•'}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
