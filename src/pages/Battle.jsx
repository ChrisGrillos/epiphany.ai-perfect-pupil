import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Swords,
  Loader2
} from 'lucide-react';

import BattleSetup from '@/components/battle/BattleSetup';
import BattleArena from '@/components/battle/BattleArena';
import BattleResultScreen from '@/components/battle/BattleResultScreen';

export default function Battle() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('setup'); // setup | battle | result
  const [roster, setRoster] = useState([]);
  const [companion, setCompanion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [battleData, setBattleData] = useState(null);
  const [resultData, setResultData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [companions, rosterUnits] = await Promise.all([
      base44.entities.Companion.list(),
      base44.entities.PupilRoster.list()
    ]);

    if (companions.length === 0) {
      navigate(createPageUrl('Welcome'));
      return;
    }

    setCompanion(companions[0]);
    setRoster(rosterUnits.filter(r => r.companion_id !== 'system'));
    setLoading(false);
  };

  const handleStartBattle = async ({ battleType, mode, selectedIds, pcpBet }) => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('startBattle', {
        battle_type: battleType,
        mode,
        team_a_ids: selectedIds,
        pcp_bet: pcpBet || 0
      });

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      setBattleData(response.data);
      setPhase('battle');
    } catch (error) {
      toast.error(error?.message || 'Failed to start battle.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRound = async (actions) => {
    const response = await base44.functions.invoke('resolveBattleRound', {
      battle_id: battleData.battle.id,
      actions
    });

    if (response.data?.error) {
      toast.error(response.data.error);
      return response.data;
    }

    const roundResult = response.data;
    if ((roundResult.rejected_actions || []).length > 0) {
      toast.error('Some submitted actions were rejected by the server and auto-resolved.');
    }

    // Update local battle data with new state
    setBattleData(prev => ({
      ...prev,
      battle: {
        ...prev.battle,
        current_round: roundResult.round,
        initiative_queue: roundResult.next_initiative || prev.battle.initiative_queue,
        status: roundResult.battle_status
      },
      team_a: roundResult.team_a_state || prev.team_a,
      team_b: roundResult.team_b_state || prev.team_b,
      turns: [...(prev.turns || []), ...roundResult.turns]
    }));

    if (roundResult.battle_status === 'completed') {
      // Finalize and get rewards
      const finalResponse = await base44.functions.invoke('finalizeBattle', {
        battle_id: battleData.battle.id
      });
      if (finalResponse.data?.error) {
        toast.error(finalResponse.data.error);
        return roundResult;
      }
      setResultData({
        ...roundResult,
        ...finalResponse.data
      });
      setPhase('result');

      // Phase 5: Check achievements after battle
      if (companion?.id) {
        base44.functions.invoke('checkAchievements', { companion_id: companion.id }).then(res => {
          if (res.data?.newly_unlocked?.length > 0) {
            res.data.newly_unlocked.forEach(a => {
              toast.success(`🏆 Achievement: ${a.key.replace(/_/g, ' ')} (+${a.xp} XP)`);
            });
          }
        });
      }
    }

    return roundResult;
  };

  const handleReturnHome = () => {
    navigate(createPageUrl('Home'));
  };

  const handleNewBattle = () => {
    setBattleData(null);
    setResultData(null);
    setPhase('setup');
    loadData();
  };

  if (loading && phase === 'setup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900">
      {/* Header */}
      {phase !== 'battle' && (
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-violet-500/30 sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleReturnHome} className="text-white hover:bg-violet-800">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Swords className="w-6 h-6 text-violet-400" />
            <div>
              <h1 className="font-bold text-white">Perfect Pupil Arena™</h1>
              <p className="text-xs text-violet-300">Battle System</p>
            </div>
          </div>
        </header>
      )}

      <AnimatePresence mode="wait">
        {phase === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BattleSetup
              roster={roster}
              companion={companion}
              onStartBattle={handleStartBattle}
              loading={loading}
            />
          </motion.div>
        )}

        {phase === 'battle' && battleData && (
          <motion.div key="battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BattleArena
              battle={battleData.battle}
              teamA={battleData.team_a}
              teamB={battleData.team_b}
              isPlayerTeamA={true}
              onTakeTurn={handleSubmitRound}
            />
          </motion.div>
        )}

        {phase === 'result' && resultData && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BattleResultScreen
              result={resultData}
              onNewBattle={handleNewBattle}
              onReturnHome={handleReturnHome}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
