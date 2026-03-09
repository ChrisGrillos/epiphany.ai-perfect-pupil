import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Swords, Home, Frown, Minus } from 'lucide-react';

export default function BattleResultScreen({ result, onNewBattle, onReturnHome }) {
  const isWin = result?.winner === 'team_a';
  const isDraw = result?.winner === 'draw';

  const icon = isWin ? Trophy : isDraw ? Minus : Frown;
  const Icon = icon;
  const title = isWin ? 'Victory!' : isDraw ? 'Draw!' : 'Defeat';
  const color = isWin ? 'text-amber-400' : isDraw ? 'text-slate-400' : 'text-red-400';
  const bgGlow = isWin ? 'from-amber-900/20' : isDraw ? 'from-slate-800/20' : 'from-red-900/20';

  const xpAwards = result?.xp_awards || {};
  const pcpAwards = result?.pcp_awards || {};
  const teamASummary = result?.result?.team_a_summary || {};

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="text-center mb-8"
      >
        <motion.div
          animate={{ rotate: isWin ? [0, -10, 10, -5, 5, 0] : [0] }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <Icon className={`w-20 h-20 mx-auto ${color}`} />
        </motion.div>
        <h1 className={`text-4xl font-bold mt-4 ${color}`}>{title}</h1>
        {result?.result?.total_rounds && (
          <p className="text-slate-400 mt-2">
            Completed in {result.result.total_rounds} round{result.result.total_rounds > 1 ? 's' : ''}
          </p>
        )}
      </motion.div>

      {/* Team Stats */}
      <Card className="bg-slate-800/50 border-violet-500/30 mb-6">
        <CardContent className="p-6">
          <h3 className="text-white font-semibold mb-4">Your Team Performance</h3>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Damage Dealt" value={teamASummary.total_damage_dealt || 0} />
            <Stat label="Damage Taken" value={teamASummary.total_damage_taken || 0} />
            <Stat label="KOs Scored" value={teamASummary.kos_scored || 0} />
            <Stat label="KOs Suffered" value={teamASummary.kos_suffered || 0} />
          </div>
        </CardContent>
      </Card>

      {/* Rewards */}
      <Card className="bg-slate-800/50 border-violet-500/30 mb-8">
        <CardContent className="p-6">
          <h3 className="text-white font-semibold mb-4">Rewards Earned</h3>
          <div className="space-y-3">
            {Object.entries(xpAwards).map(([id, xp]) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Unit {id.slice(-6)}</span>
                <Badge className="bg-violet-600 text-white">+{xp} XP</Badge>
              </div>
            ))}
            {Object.entries(pcpAwards).map(([userId, pcp]) => (
              pcp > 0 && (
                <div key={userId} className="flex items-center justify-between text-sm">
                  <span className="text-amber-300">PcP Earned</span>
                  <Badge className="bg-amber-600 text-white">+{pcp} PcP</Badge>
                </div>
              )
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={onNewBattle}
          className="flex-1 h-12 bg-violet-600 hover:bg-violet-700"
        >
          <Swords className="w-5 h-5 mr-2" />
          Battle Again
        </Button>
        <Button
          onClick={onReturnHome}
          variant="outline"
          className="flex-1 h-12 border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          <Home className="w-5 h-5 mr-2" />
          Return Home
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center p-3 bg-slate-700/50 rounded-xl">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}