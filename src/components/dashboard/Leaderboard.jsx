import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';

const RANK_COLORS = [
  'bg-amber-100 text-amber-700 border-amber-300',
  'bg-slate-100 text-slate-600 border-slate-300',
  'bg-orange-100 text-orange-700 border-orange-300',
];

const RANK_ICONS = [Trophy, Medal, Award];

export default function Leaderboard({ roster }) {
  if (!roster || roster.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Trophy className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No roster units yet — recruit some in battle!</p>
      </div>
    );
  }

  // Sort by total XP then wins
  const sorted = [...roster].sort((a, b) => {
    const scoreA = (a.total_xp || 0) * 10 + (a.wins || 0) * 100;
    const scoreB = (b.total_xp || 0) * 10 + (b.wins || 0) * 100;
    return scoreB - scoreA;
  });

  return (
    <div className="space-y-2">
      {sorted.map((unit, i) => {
        const RankIcon = i < 3 ? RANK_ICONS[i] : null;
        const winRate = (unit.total_battles || 0) > 0 
          ? Math.round(((unit.wins || 0) / unit.total_battles) * 100)
          : 0;

        return (
          <motion.div
            key={unit.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 p-3 rounded-xl border ${
              i < 3 ? RANK_COLORS[i] : 'bg-card border-border'
            }`}
          >
            <div className="w-8 text-center font-bold text-lg">
              {i < 3 && RankIcon ? (
                <RankIcon className="w-5 h-5 mx-auto" />
              ) : (
                <span className="text-muted-foreground">#{i + 1}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{unit.creature_name || unit.creature_template}</span>
                <Badge variant="outline" className="text-xs capitalize">{unit.element}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>{unit.total_battles || 0} battles</span>
                <span>{unit.wins || 0}W / {unit.losses || 0}L</span>
                <span>{winRate}% WR</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-bold text-violet-600">{unit.total_xp || 0}</div>
              <div className="text-xs text-muted-foreground">XP</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}