import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Trophy, 
  Heart, 
  Brain, 
  Sparkles, 
  Users,
  Lock,
  Check
} from 'lucide-react';

const ACHIEVEMENT_DEFINITIONS = [
  // Care
  { key: 'first_feed', name: 'First Meal', description: 'Feed your companion for the first time', icon: Heart, category: 'care', xp: 10 },
  { key: 'fed_10', name: 'Caring Friend', description: 'Feed your companion 10 times', icon: Heart, category: 'care', xp: 25 },
  { key: 'fed_50', name: 'Devoted Caretaker', description: 'Feed your companion 50 times', icon: Heart, category: 'care', xp: 100 },
  { key: 'first_exercise', name: 'First Workout', description: 'Exercise with your companion', icon: Heart, category: 'care', xp: 10 },
  { key: 'exercise_20', name: 'Fitness Buff', description: 'Exercise 20 times', icon: Heart, category: 'care', xp: 50 },
  { key: 'total_actions_100', name: 'Active Caretaker', description: '100 total care actions', icon: Heart, category: 'care', xp: 150 },
  { key: 'total_actions_500', name: 'Legendary Caretaker', description: '500 total care actions', icon: Heart, category: 'care', xp: 500 },
  
  // Learning
  { key: 'first_study', name: 'First Lesson', description: 'Study with your companion', icon: Brain, category: 'learning', xp: 10 },
  { key: 'knowledge_25', name: 'Quick Learner', description: 'Reach 25 knowledge', icon: Brain, category: 'learning', xp: 50 },
  { key: 'knowledge_50', name: 'Scholar', description: 'Reach 50 knowledge', icon: Brain, category: 'learning', xp: 100 },
  { key: 'knowledge_100', name: 'Genius', description: 'Reach 100 knowledge', icon: Brain, category: 'learning', xp: 500 },
  { key: 'first_memory', name: 'First Memory', description: 'Your companion forms its first memory', icon: Brain, category: 'learning', xp: 15 },
  { key: 'memories_20', name: 'Deep Mind', description: 'Companion has 20+ memories', icon: Brain, category: 'learning', xp: 75 },
  { key: 'first_rule', name: 'Rule Maker', description: 'Create your first behavior rule', icon: Brain, category: 'learning', xp: 20 },
  
  // Evolution
  { key: 'first_puzzle', name: 'DNA Pioneer', description: 'Complete your first evolution puzzle', icon: Sparkles, category: 'evolution', xp: 50 },
  { key: 'puzzles_10', name: 'Evolution Master', description: 'Complete 10 evolution puzzles', icon: Sparkles, category: 'evolution', xp: 200 },
  { key: 'evolved_child', name: 'Growing Up', description: 'Evolve to child stage', icon: Sparkles, category: 'evolution', xp: 50 },
  { key: 'evolved_teenager', name: 'Coming of Age', description: 'Evolve to teenager stage', icon: Sparkles, category: 'evolution', xp: 100 },
  { key: 'evolved_adult', name: 'Full Bloom', description: 'Evolve to adult stage', icon: Sparkles, category: 'evolution', xp: 300 },
  { key: 'chose_path', name: 'Destiny Chosen', description: 'Choose an evolution path', icon: Sparkles, category: 'evolution', xp: 75 },

  // Social/Bond
  { key: 'trust_25', name: 'Building Trust', description: 'Reach 25 trust level', icon: Users, category: 'social', xp: 25 },
  { key: 'trust_50', name: 'True Bond', description: 'Reach 50 trust level', icon: Users, category: 'social', xp: 75 },
  { key: 'trust_100', name: 'Soulmates', description: 'Reach 100 trust level', icon: Users, category: 'social', xp: 250 },
  { key: 'bond_25', name: 'Growing Bond', description: 'Reach 25 bond level', icon: Users, category: 'social', xp: 30 },
  { key: 'bond_50', name: 'Strong Bond', description: 'Reach 50 bond level', icon: Users, category: 'social', xp: 80 },
  { key: 'bond_100', name: 'Unbreakable Bond', description: 'Reach 100 bond level', icon: Users, category: 'social', xp: 300 },
  
  // Battle
  { key: 'first_battle', name: 'First Blood', description: 'Complete your first battle', icon: Trophy, category: 'special', xp: 20 },
  { key: 'battles_10', name: 'Veteran', description: 'Complete 10 battles', icon: Trophy, category: 'special', xp: 75 },
  { key: 'battles_50', name: 'War Hero', description: 'Complete 50 battles', icon: Trophy, category: 'special', xp: 250 },

  // Special
  { key: 'all_stats_50', name: 'Balanced Growth', description: 'All core stats above 50', icon: Trophy, category: 'special', xp: 100 },
];

const CATEGORY_COLORS = {
  care: 'bg-rose-100 text-rose-700 border-rose-200',
  learning: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  evolution: 'bg-violet-100 text-violet-700 border-violet-200',
  social: 'bg-amber-100 text-amber-700 border-amber-200',
  special: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

export default function Achievements() {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState([]);
  const [companion, setCompanion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const [achieved, companions] = await Promise.all([
      base44.entities.Achievement.list(),
      base44.entities.Companion.list()
    ]);
    
    setAchievements(achieved);
    setCompanion(companions[0]);
    setLoading(false);
  };
  
  const isUnlocked = (key) => {
    return achievements.some(a => a.achievement_key === key);
  };
  
  const getProgress = (achievement) => {
    if (!companion) return 0;
    if (isUnlocked(achievement.key)) return 100;
    
    const progressMap = {
      knowledge_25: () => Math.min(100, ((companion.knowledge_level || 0) / 25) * 100),
      knowledge_50: () => Math.min(100, ((companion.knowledge_level || 0) / 50) * 100),
      knowledge_100: () => Math.min(100, ((companion.knowledge_level || 0) / 100) * 100),
      trust_25: () => Math.min(100, ((companion.trust_level || 0) / 25) * 100),
      trust_50: () => Math.min(100, ((companion.trust_level || 0) / 50) * 100),
      trust_100: () => Math.min(100, ((companion.trust_level || 0) / 100) * 100),
      bond_25: () => Math.min(100, ((companion.bond_level || 0) / 25) * 100),
      bond_50: () => Math.min(100, ((companion.bond_level || 0) / 50) * 100),
      bond_100: () => Math.min(100, ((companion.bond_level || 0) / 100) * 100),
      total_actions_100: () => Math.min(100, ((companion.total_care_actions || 0) / 100) * 100),
      total_actions_500: () => Math.min(100, ((companion.total_care_actions || 0) / 500) * 100),
    };

    const fn = progressMap[achievement.key];
    return fn ? fn() : 0;
  };
  
  const totalXP = achievements.reduce((sum, a) => {
    const def = ACHIEVEMENT_DEFINITIONS.find(d => d.key === a.achievement_key);
    return sum + (def?.xp || 0);
  }, 0);
  
  const filteredAchievements = selectedCategory === 'all' 
    ? ACHIEVEMENT_DEFINITIONS 
    : ACHIEVEMENT_DEFINITIONS.filter(a => a.category === selectedCategory);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          🏆
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Home'))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Achievements
              </h1>
              <p className="text-xs text-slate-500">Track your progress</p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-slate-500">Total XP Earned</p>
            <p className="text-lg font-bold text-violet-600">{totalXP} XP</p>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-violet-600">{achievements.length}</p>
              <p className="text-sm text-slate-500">Unlocked</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-400">{ACHIEVEMENT_DEFINITIONS.length - achievements.length}</p>
              <p className="text-sm text-slate-500">Remaining</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-500">{totalXP}</p>
              <p className="text-sm text-slate-500">XP Earned</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-500">
                {Math.round((achievements.length / ACHIEVEMENT_DEFINITIONS.length) * 100)}%
              </p>
              <p className="text-sm text-slate-500">Complete</p>
            </div>
          </div>
          
          <div className="mt-4">
            <Progress 
              value={(achievements.length / ACHIEVEMENT_DEFINITIONS.length) * 100} 
              className="h-2"
            />
          </div>
        </motion.div>
        
        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {['all', 'care', 'learning', 'evolution', 'social', 'special'].map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={`capitalize whitespace-nowrap ${selectedCategory === cat ? 'bg-violet-600' : ''}`}
            >
              {cat}
            </Button>
          ))}
        </div>
        
        {/* Achievement Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAchievements.map((achievement, index) => {
            const Icon = achievement.icon;
            const unlocked = isUnlocked(achievement.key);
            const progress = getProgress(achievement);
            
            return (
              <motion.div
                key={achievement.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  relative bg-white rounded-2xl p-4 border-2 transition-all
                  ${unlocked 
                    ? 'border-amber-300 shadow-md shadow-amber-100' 
                    : 'border-slate-200 opacity-75'
                  }
                `}
              >
                <div className="flex gap-4">
                  {/* Icon */}
                  <div className={`
                    w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0
                    ${unlocked 
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
                      : 'bg-slate-100'
                    }
                  `}>
                    {unlocked ? (
                      <Icon className="w-7 h-7 text-white" />
                    ) : (
                      <Lock className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-semibold ${unlocked ? 'text-slate-800' : 'text-slate-500'}`}>
                        {achievement.name}
                      </h3>
                      <span className={`
                        text-xs px-2 py-0.5 rounded-full border
                        ${CATEGORY_COLORS[achievement.category]}
                      `}>
                        {achievement.category}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-500 mb-2">{achievement.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${unlocked ? 'text-amber-600' : 'text-slate-400'}`}>
                        +{achievement.xp} XP
                      </span>
                      
                      {!unlocked && progress > 0 && progress < 100 && (
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="w-20 h-1.5" />
                          <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
                        </div>
                      )}
                      
                      {unlocked && (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <Check className="w-4 h-4" />
                          <span className="text-xs font-medium">Unlocked</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Unlocked Glow */}
                {unlocked && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400/10 to-orange-400/10 pointer-events-none" />
                )}
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}