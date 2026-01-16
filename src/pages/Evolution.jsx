import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Sparkles, Lock, Crown } from 'lucide-react';
import DNAGrid from '@/components/puzzle/DNAGrid';
import CompanionAvatar from '@/components/companion/CompanionAvatar';

export default function Evolution() {
  const navigate = useNavigate();
  const [companion, setCompanion] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState('easy');
  const [completedPuzzles, setCompletedPuzzles] = useState([]);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const [companions, subs, puzzles] = await Promise.all([
      base44.entities.Companion.list(),
      base44.entities.Subscription.list(),
      base44.entities.EvolutionPuzzle.list()
    ]);
    
    if (companions.length === 0) {
      navigate(createPageUrl('Welcome'));
      return;
    }
    
    setCompanion(companions[0]);
    setSubscription(subs[0] || { tier: 'free' });
    setCompletedPuzzles(puzzles.filter(p => p.completed));
    setLoading(false);
  };
  
  const handlePuzzleComplete = async (result) => {
    if (!companion) return;
    
    // Calculate stat bonuses based on puzzle completion
    const bonuses = {
      personality_openness: Math.floor(Math.random() * 3) + 1,
      personality_curiosity: Math.floor(Math.random() * 3) + 1,
      experience_points: (companion.experience_points || 0) + (50 * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3))
    };
    
    // Update companion
    await base44.entities.Companion.update(companion.id, {
      ...bonuses,
      evolution_dna: result
    });
    
    // Log puzzle completion
    await base44.entities.EvolutionPuzzle.create({
      companion_id: companion.id,
      puzzle_type: 'full_helix',
      completed: true,
      completion_reward: bonuses,
      difficulty
    });
    
    setCompanion(prev => ({
      ...prev,
      ...bonuses
    }));
    
    toast.success(`Evolution complete! +${bonuses.experience_points} XP earned!`);
  };
  
  const isLocked = !['premium', 'elite'].includes(subscription?.tier);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          🧬
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
                <Sparkles className="w-5 h-5 text-violet-500" />
                Guided Evolution
              </h1>
              <p className="text-xs text-slate-500">Shape your companion's growth</p>
            </div>
          </div>
          
          {!isLocked && (
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Companion Preview */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
            >
              <div className="text-center mb-4">
                <h2 className="font-semibold text-slate-800">{companion?.name}</h2>
                <p className="text-xs text-slate-500">
                  {companion?.experience_points || 0} XP
                </p>
              </div>
              
              <div className="flex justify-center mb-4">
                <CompanionAvatar companion={companion} size="medium" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Stage</span>
                  <span className="font-medium capitalize">{companion?.stage}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Puzzles Solved</span>
                  <span className="font-medium">{completedPuzzles.length}</span>
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* Puzzle Area */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
            >
              {isLocked ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 mb-6">
                    <Lock className="w-10 h-10 text-slate-400" />
                  </div>
                  
                  <h2 className="text-2xl font-bold text-slate-800 mb-3">
                    Evolution Locked
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto mb-6">
                    Upgrade to Premium ($4.99/month) or Elite ($9.99/month) to unlock the DNA Evolution Puzzle and take control of your companion's growth!
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button 
                      onClick={() => navigate(createPageUrl('Settings'))}
                      className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90"
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade to Premium
                    </Button>
                    <Button 
                      onClick={() => navigate(createPageUrl('Settings'))}
                      variant="outline"
                    >
                      View All Plans
                    </Button>
                  </div>
                  
                  {/* Feature Preview */}
                  <div className="mt-12 p-6 bg-slate-50 rounded-xl">
                    <h3 className="font-semibold text-slate-700 mb-4">What you'll unlock:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                      {[
                        { title: 'Body Evolution', desc: 'Control form, shape, and colors' },
                        { title: 'Personality Shaping', desc: 'Guide trait development' },
                        { title: 'Ability Unlock', desc: 'Discover special powers' }
                      ].map((feature, i) => (
                        <div key={i} className="p-3 bg-white rounded-lg">
                          <h4 className="font-medium text-slate-800 text-sm">{feature.title}</h4>
                          <p className="text-xs text-slate-500">{feature.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <DNAGrid
                  companion={companion}
                  puzzle={null}
                  onComplete={handlePuzzleComplete}
                  difficulty={difficulty}
                />
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}