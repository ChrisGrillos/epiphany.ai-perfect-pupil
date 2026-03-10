import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, User, Activity, Trophy, BarChart3 } from 'lucide-react';

import CompanionProfile from '@/components/dashboard/CompanionProfile';
import ActivityTimeline from '@/components/dashboard/ActivityTimeline';
import Leaderboard from '@/components/dashboard/Leaderboard';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function CompanionDashboard() {
  const navigate = useNavigate();
  const [companion, setCompanion] = useState(null);
  const [logs, setLogs] = useState([]);
  const [roster, setRoster] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const companions = await base44.entities.Companion.list();
    if (companions.length === 0) {
      navigate(createPageUrl('Welcome'));
      return;
    }
    const comp = companions[0];
    setCompanion(comp);

    const [interactionLogs, rosterUnits, achs] = await Promise.all([
      base44.entities.InteractionLog.filter({ companion_id: comp.id }, '-created_date', 50),
      base44.entities.PupilRoster.filter({ companion_id: comp.id }),
      base44.entities.Achievement.list()
    ]);

    setLogs(interactionLogs || []);
    setRoster(rosterUnits || []);
    setAchievements(achs || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="text-5xl">
          📊
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 pb-16 md:pb-0">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="select-none" onClick={() => navigate(createPageUrl('Home'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-500" />
              Companion Dashboard
            </h1>
            <p className="text-xs text-slate-500">{companion?.name}'s full profile & stats</p>
          </div>
        </div>
      </header>

      <PullToRefresh onRefresh={loadData}>
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-white border border-slate-200 rounded-xl p-1 mb-6">
            <TabsTrigger value="profile" className="flex-1 rounded-lg data-[state=active]:bg-violet-100 select-none">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 rounded-lg data-[state=active]:bg-violet-100 select-none">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 rounded-lg data-[state=active]:bg-violet-100 select-none">
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <CompanionProfile companion={companion} roster={roster} />
          </TabsContent>

          <TabsContent value="activity">
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-violet-500" />
                Recent Activity
              </h3>
              <ActivityTimeline logs={logs} />
            </div>
          </TabsContent>

          <TabsContent value="leaderboard">
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Roster Leaderboard
              </h3>
              <Leaderboard roster={roster} />
            </div>

            {/* Achievement Summary */}
            <div className="mt-4 bg-white rounded-2xl p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-3">Achievement Progress</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-amber-50 rounded-xl">
                  <div className="text-2xl font-bold text-amber-600">{achievements.length}</div>
                  <div className="text-xs text-amber-500">Unlocked</div>
                </div>
                <div className="p-3 bg-violet-50 rounded-xl">
                  <div className="text-2xl font-bold text-violet-600">
                    {achievements.reduce((s, a) => s + (a.xp_reward || 0), 0)}
                  </div>
                  <div className="text-xs text-violet-500">XP from Achievements</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <div className="text-2xl font-bold text-emerald-600">
                    {companion?.total_care_actions || 0}
                  </div>
                  <div className="text-xs text-emerald-500">Total Actions</div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      </PullToRefresh>

      <BottomTabBar />
    </div>
  );
}