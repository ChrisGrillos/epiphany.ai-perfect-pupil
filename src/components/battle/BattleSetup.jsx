import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Swords,
  Shield,
  Zap,
  Check,
  Loader2
} from 'lucide-react';

const ALIGNMENT_COLORS = {
  guardian: 'bg-blue-100 text-blue-700',
  rogue: 'bg-red-100 text-red-700',
  cipher: 'bg-purple-100 text-purple-700'
};

const ELEMENT_COLORS = {
  heat: 'bg-orange-500', tide: 'bg-blue-500', gale: 'bg-cyan-400',
  stone: 'bg-amber-700', volt: 'bg-yellow-400', vine: 'bg-green-500',
  lumen: 'bg-white border border-slate-300', umber: 'bg-slate-800'
};

export default function BattleSetup({ roster, companion, onStartBattle, loading }) {
  const [mode, setMode] = useState('1v1');
  const [battleType, setBattleType] = useState('training_ai');
  const [selectedIds, setSelectedIds] = useState([]);

  const maxUnits = mode === '1v1' ? 1 : 3;

  const toggleUnit = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= maxUnits) return prev;
      return [...prev, id];
    });
  };

  const handleStart = () => {
    if (selectedIds.length !== maxUnits) return;
    onStartBattle({ battleType, mode, selectedIds });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { id: '1v1', label: '1v1 Duel', icon: Swords, desc: 'Single combat' },
          { id: '3v3', label: '3v3 Team', icon: Shield, desc: 'Team battle' }
        ].map(m => (
          <motion.div key={m.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              className={`cursor-pointer transition-all ${mode === m.id ? 'border-violet-500 bg-violet-900/30' : 'border-slate-600 bg-slate-800/50'}`}
              onClick={() => { setMode(m.id); setSelectedIds([]); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <m.icon className={`w-8 h-8 ${mode === m.id ? 'text-violet-400' : 'text-slate-500'}`} />
                <div>
                  <h3 className="text-white font-bold">{m.label}</h3>
                  <p className="text-xs text-slate-400">{m.desc}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Battle Type */}
      <div className="mb-6">
        <h3 className="text-white font-semibold mb-3">Battle Type</h3>
        <div className="flex gap-3">
          {[
            { id: 'training_ai', label: 'Training (vs AI)' },
            { id: 'pupil_vs_pupil', label: 'Pupil vs Pupil (Soon)', disabled: true }
          ].map(bt => (
            <Button
              key={bt.id}
              variant={battleType === bt.id ? 'default' : 'outline'}
              onClick={() => !bt.disabled && setBattleType(bt.id)}
              disabled={bt.disabled}
              className={battleType === bt.id ? 'bg-violet-600 hover:bg-violet-700' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
            >
              {bt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Roster Selection */}
      <div className="mb-6">
        <h3 className="text-white font-semibold mb-1">Select Your Team</h3>
        <p className="text-sm text-slate-400 mb-3">Choose {maxUnits} unit{maxUnits > 1 ? 's' : ''}</p>

        {roster.length === 0 ? (
          <Card className="border-slate-600 bg-slate-800/50">
            <CardContent className="p-8 text-center">
              <Zap className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">No roster creatures yet. Evolve your companion to unlock battle units!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roster.map(unit => {
              const isSelected = selectedIds.includes(unit.id);
              const hpPct = ((unit.combat_stats?.hp || 100) / (unit.combat_stats?.max_hp || 100)) * 100;
              return (
                <motion.div key={unit.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className={`cursor-pointer transition-all ${isSelected ? 'border-violet-400 bg-violet-900/40' : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'}`}
                    onClick={() => toggleUnit(unit.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-white font-semibold">{unit.creature_name || unit.creature_template}</h4>
                          <div className="flex gap-1 mt-1">
                            <Badge className={`${ALIGNMENT_COLORS[unit.alignment]} text-xs`}>
                              {unit.alignment}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-slate-300 border-slate-500">
                              {unit.element}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-slate-300 border-slate-500">
                              {unit.evolution_stage || 'spark'}
                            </Badge>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                        <span>PWR {unit.combat_stats?.power || 10}</span>
                        <span>GRD {unit.combat_stats?.guard || 10}</span>
                        <span>SPD {unit.combat_stats?.speed || 10}</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>HP</span>
                          <span>{unit.combat_stats?.hp || 100}/{unit.combat_stats?.max_hp || 100}</span>
                        </div>
                        <Progress value={hpPct} className="h-1.5" />
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        W{unit.wins || 0} / L{unit.losses || 0} / D{unit.draws || 0}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Start Button */}
      <Button
        onClick={handleStart}
        disabled={selectedIds.length !== maxUnits || loading || roster.length === 0}
        className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-lg font-bold"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <Swords className="w-5 h-5 mr-2" />
        )}
        {loading ? 'Initializing Battle...' : `Start ${mode} Battle`}
      </Button>
    </div>
  );
}
