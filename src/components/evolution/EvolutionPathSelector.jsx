import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Shield, Sword, Sparkles, BookOpen, Zap, RefreshCw,
  ChevronRight, Star, Lock
} from 'lucide-react';

const EVOLUTION_PATHS = {
  Guardian: {
    icon: Shield,
    color: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    description: 'A protector who shields allies and endures all damage.',
    subtypes: [
      { name: 'Aegis', desc: 'Maximum defense and damage reduction', passive: 'Iron Wall: Reduce all incoming damage by 15%' },
      { name: 'Sentinel', desc: 'Counter-attacks when allies are hit', passive: 'Vigilant Eye: Auto-counter when an ally takes critical damage' },
      { name: 'Bastion', desc: 'Regenerative tank that self-heals', passive: 'Living Fortress: Regenerate 5% HP per turn' }
    ],
    requiredTraits: { nurturing: 10, disciplined: 8 },
    signatureAbility: 'Unbreakable Vow: Absorb all damage targeted at allies for 2 turns'
  },
  Predator: {
    icon: Sword,
    color: 'from-red-500 to-orange-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    description: 'A relentless attacker that overwhelms with raw power.',
    subtypes: [
      { name: 'Blade', desc: 'Critical hit specialist with burst damage', passive: 'Razor Instinct: +25% critical hit chance' },
      { name: 'Ravager', desc: 'Multi-hit attacks that shred defenses', passive: 'Armor Break: Attacks reduce target guard by 10%' },
      { name: 'Hunter', desc: 'Targets weakened enemies for the kill', passive: 'Predator Sense: +30% damage to enemies below 40% HP' }
    ],
    requiredTraits: { aggressive: 10, disciplined: 5 },
    signatureAbility: 'Apex Strike: Deal 300% power damage, ignoring all defenses'
  },
  Mystic: {
    icon: Sparkles,
    color: 'from-purple-500 to-violet-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    description: 'A wielder of elemental forces and status manipulation.',
    subtypes: [
      { name: 'Elementalist', desc: 'Mastery over elemental combos', passive: 'Elemental Resonance: Elemental moves deal 20% bonus damage' },
      { name: 'Enchanter', desc: 'Buffs allies and debuffs enemies', passive: 'Aura Weaver: All buffs last 1 extra turn' },
      { name: 'Seer', desc: 'Predicts and negates enemy moves', passive: 'Foresight: 20% chance to dodge any attack' }
    ],
    requiredTraits: { curious: 10, disciplined: 5 },
    signatureAbility: 'Arcane Tempest: Hit all enemies with their elemental weakness'
  },
  Scholar: {
    icon: BookOpen,
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    description: 'A strategist who heals, supports, and outsmarts opponents.',
    subtypes: [
      { name: 'Medic', desc: 'Powerful healer that keeps the team alive', passive: 'Triage: Healing moves are 25% more effective' },
      { name: 'Tactician', desc: 'Manipulates turn order and battlefield', passive: 'Battle Mind: Team gains +10% speed' },
      { name: 'Sage', desc: 'Balanced support with knowledge-based attacks', passive: 'Wisdom: Knowledge level adds to all stat calculations' }
    ],
    requiredTraits: { curious: 8, nurturing: 8 },
    signatureAbility: 'Grand Strategy: Reset all ally cooldowns and heal 30% HP'
  },
  Trickster: {
    icon: Zap,
    color: 'from-amber-500 to-yellow-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    description: 'An unpredictable force that exploits chaos and deception.',
    subtypes: [
      { name: 'Phantom', desc: 'Evades and strikes from the shadows', passive: 'Shadow Step: +30% evasion rate' },
      { name: 'Jester', desc: 'Random powerful effects each turn', passive: 'Wild Card: Each turn, gain a random powerful buff' },
      { name: 'Saboteur', desc: 'Disables and weakens enemy abilities', passive: 'Disruption: 20% chance to jam enemy moves' }
    ],
    requiredTraits: { chaotic: 10, curious: 5 },
    signatureAbility: 'Chaos Cascade: Apply 3 random status effects to all enemies'
  },
  Adaptive: {
    icon: RefreshCw,
    color: 'from-slate-500 to-gray-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-700',
    description: 'A balanced evolution that adapts to any situation.',
    subtypes: [
      { name: 'Hybrid', desc: 'Jack of all trades, decent at everything', passive: 'Versatile: +10% to all stats' },
      { name: 'Mimic', desc: 'Copies enemy abilities temporarily', passive: 'Mirror: Can use the last move used against you' },
      { name: 'Catalyst', desc: 'Enhances team composition bonuses', passive: 'Synergy: Team composition bonuses are doubled' }
    ],
    requiredTraits: {},
    signatureAbility: 'Adaptation: Copy the strongest enemy unit\'s highest stat for 3 turns'
  }
};

export default function EvolutionPathSelector({ companion, onSelect }) {
  const [selectedPath, setSelectedPath] = useState(null);
  const [selectedSubtype, setSelectedSubtype] = useState(null);

  const aff = companion?.trait_affinity || {};

  const meetsRequirements = (path) => {
    const reqs = EVOLUTION_PATHS[path].requiredTraits;
    for (const [trait, min] of Object.entries(reqs)) {
      if ((aff[trait] || 0) < min) return false;
    }
    return true;
  };

  const handleConfirm = () => {
    if (!selectedPath || !selectedSubtype) return;
    const pathData = EVOLUTION_PATHS[selectedPath];
    const subtype = pathData.subtypes.find(s => s.name === selectedSubtype);
    onSelect({
      evolution_path: selectedPath,
      subtype: selectedSubtype,
      signature_passive: subtype.passive,
      signature_ability: pathData.signatureAbility
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800">Choose Evolution Path</h2>
        <p className="text-sm text-slate-500 mt-1">
          This choice is permanent and will shape {companion?.name}'s final form
        </p>
      </div>

      {/* Path Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(EVOLUTION_PATHS).map(([pathName, path]) => {
          const PathIcon = path.icon;
          const isLocked = !meetsRequirements(pathName);
          const isSelected = selectedPath === pathName;

          return (
            <motion.button
              key={pathName}
              whileHover={!isLocked ? { scale: 1.02 } : {}}
              whileTap={!isLocked ? { scale: 0.98 } : {}}
              onClick={() => {
                if (isLocked) return;
                setSelectedPath(pathName);
                setSelectedSubtype(null);
              }}
              className={`
                relative p-4 rounded-2xl border-2 text-left transition-all
                ${isSelected ? `${path.borderColor} ${path.bgColor} shadow-lg` : 'border-slate-200 bg-white hover:border-slate-300'}
                ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {isLocked && (
                <div className="absolute top-2 right-2">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
              )}
              <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${path.color} text-white mb-3`}>
                <PathIcon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">{pathName}</h3>
              <p className="text-xs text-slate-500 mt-1">{path.description}</p>
              
              {isLocked && (
                <div className="mt-2">
                  <p className="text-xs text-red-500">
                    Requires: {Object.entries(path.requiredTraits).map(([t, v]) => `${t} ≥ ${v}`).join(', ')}
                  </p>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Subtype Selection */}
      {selectedPath && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${EVOLUTION_PATHS[selectedPath].bgColor} rounded-2xl p-6 border ${EVOLUTION_PATHS[selectedPath].borderColor}`}
        >
          <h3 className="font-bold text-slate-800 mb-1">Choose Specialization</h3>
          <p className="text-xs text-slate-500 mb-4">Each specialization grants a unique passive ability</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {EVOLUTION_PATHS[selectedPath].subtypes.map(sub => (
              <motion.button
                key={sub.name}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedSubtype(sub.name)}
                className={`
                  p-4 rounded-xl border-2 text-left transition-all
                  ${selectedSubtype === sub.name 
                    ? `${EVOLUTION_PATHS[selectedPath].borderColor} bg-white shadow-md` 
                    : 'border-transparent bg-white/60 hover:bg-white/80'
                  }
                `}
              >
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  {sub.name}
                  {selectedSubtype === sub.name && <Star className="w-3 h-3 text-amber-500" />}
                </h4>
                <p className="text-xs text-slate-500 mt-1">{sub.desc}</p>
                <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-600"><strong>Passive:</strong> {sub.passive}</p>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Signature Ability Preview */}
          <div className="mt-4 p-3 bg-white/80 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-slate-700">Signature Ability (unlocked at Adult stage)</span>
            </div>
            <p className="text-sm text-slate-600">{EVOLUTION_PATHS[selectedPath].signatureAbility}</p>
          </div>

          {/* Confirm */}
          {selectedSubtype && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex justify-end"
            >
              <Button onClick={handleConfirm} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90">
                <ChevronRight className="w-4 h-4 mr-1" />
                Confirm: {selectedPath} — {selectedSubtype}
              </Button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
