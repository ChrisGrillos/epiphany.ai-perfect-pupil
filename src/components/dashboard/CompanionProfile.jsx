import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import CompanionAvatar from '@/components/companion/CompanionAvatar';
import { Swords, Shield, Heart, Zap, Sparkles, Star } from 'lucide-react';

export default function CompanionProfile({ companion, roster }) {
  if (!companion) return null;

  const aff = companion.trait_affinity || {};
  const maxAff = Math.max(aff.aggressive || 0, aff.nurturing || 0, aff.curious || 0, aff.chaotic || 0, aff.disciplined || 0, 1);

  const traitBars = [
    { key: 'aggressive', label: 'Aggressive', color: 'bg-red-500', value: aff.aggressive || 0 },
    { key: 'nurturing', label: 'Nurturing', color: 'bg-pink-500', value: aff.nurturing || 0 },
    { key: 'curious', label: 'Curious', color: 'bg-cyan-500', value: aff.curious || 0 },
    { key: 'chaotic', label: 'Chaotic', color: 'bg-amber-500', value: aff.chaotic || 0 },
    { key: 'disciplined', label: 'Disciplined', color: 'bg-indigo-500', value: aff.disciplined || 0 },
  ];

  const totalBattles = (roster || []).reduce((s, r) => s + (r.total_battles || 0), 0);
  const totalWins = (roster || []).reduce((s, r) => s + (r.wins || 0), 0);
  const winRate = totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Identity Card */}
      <div className="bg-gradient-to-br from-violet-100 to-cyan-50 dark:from-violet-950 dark:to-cyan-950 rounded-2xl p-6 text-center">
        <div className="flex justify-center mb-4">
          <CompanionAvatar companion={companion} size="large" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">{companion.name}</h2>
        <p className="text-sm text-muted-foreground capitalize">{companion.stage} • {companion.species}</p>
        
        <div className="flex justify-center gap-2 mt-3 flex-wrap">
          <Badge className="bg-violet-100 text-violet-700">{companion.build_archetype || 'Adaptive'}</Badge>
          <Badge className="bg-cyan-100 text-cyan-700">{companion.body_frame || 'Balanced'}</Badge>
          <Badge className="bg-amber-100 text-amber-700">{companion.temperament || 'Calm'}</Badge>
          {companion.evolution_path && (
            <Badge className="bg-purple-100 text-purple-700">{companion.evolution_path} — {companion.subtype}</Badge>
          )}
        </div>
      </div>

      {/* Core Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox icon={Star} label="Level" value={companion.level || 1} color="text-amber-500" />
        <StatBox icon={Zap} label="XP" value={companion.experience_points || 0} color="text-violet-500" />
        <StatBox icon={Heart} label="Bond" value={`${companion.bond_level || 0}/100`} color="text-pink-500" />
        <StatBox icon={Swords} label="Win Rate" value={`${winRate}%`} color="text-red-500" />
      </div>

      {/* Trait Affinity Radar */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <h3 className="font-semibold text-foreground text-sm mb-3">Trait Affinity</h3>
        <div className="space-y-2">
          {traitBars.map(trait => (
            <div key={trait.key} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20">{trait.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(trait.value / maxAff) * 100}%` }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className={`h-full rounded-full ${trait.color}`}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground w-8 text-right">{trait.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Combat Lifetime Stats */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <h3 className="font-semibold text-foreground text-sm mb-3">Combat History</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 bg-red-50 rounded-xl">
            <div className="text-lg font-bold text-red-600">{companion.combat_damage_dealt || 0}</div>
            <div className="text-xs text-red-500">Damage Dealt</div>
          </div>
          <div className="p-2 bg-emerald-50 rounded-xl">
            <div className="text-lg font-bold text-emerald-600">{companion.combat_healing_done || 0}</div>
            <div className="text-xs text-emerald-500">Healing Done</div>
          </div>
          <div className="p-2 bg-purple-50 rounded-xl">
            <div className="text-lg font-bold text-purple-600">{companion.combat_status_inflicted || 0}</div>
            <div className="text-xs text-purple-500">Status Effects</div>
          </div>
        </div>
      </div>

      {/* Signature Abilities */}
      {companion.signature_passive && (
        <div className="bg-card rounded-2xl p-4 border border-border space-y-2">
          <h3 className="font-semibold text-foreground text-sm">Signature Abilities</h3>
          <div className="p-3 bg-amber-50 rounded-xl">
            <div className="text-xs text-amber-600 font-semibold flex items-center gap-1 mb-1">
              <Shield className="w-3 h-3" /> Passive
            </div>
            <p className="text-sm text-amber-700">{companion.signature_passive}</p>
          </div>
          {companion.signature_ability && (
            <div className="p-3 bg-purple-50 rounded-xl">
              <div className="text-xs text-purple-600 font-semibold flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3" /> Ultimate
              </div>
              <p className="text-sm text-purple-700">{companion.signature_ability}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}