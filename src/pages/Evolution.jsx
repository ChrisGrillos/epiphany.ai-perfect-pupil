import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Sparkles, Lock, Crown, Zap, GitBranch } from 'lucide-react';
import DNAGrid from '@/components/puzzle/DNAGrid';
import CompanionAvatar from '@/components/companion/CompanionAvatar';
import EvolutionPathSelector from '@/components/evolution/EvolutionPathSelector';

export default function Evolution() {
  const navigate = useNavigate();
  const [companion, setCompanion] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState('easy');
  const [completedPuzzles, setCompletedPuzzles] = useState([]);
  const [showPathSelector, setShowPathSelector] = useState(false);
  
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
    
    const bonuses = {
      personality_openness: Math.floor(Math.random() * 3) + 1,
      personality_curiosity: Math.floor(Math.random() * 3) + 1,
      experience_points: (companion.experience_points || 0) + (50 * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3))
    };
    
    await base44.entities.Companion.update(companion.id, {
      ...bonuses,
      evolution_dna: result
    });
    
    await base44.entities.EvolutionPuzzle.create({
      companion_id: companion.id,
      puzzle_type: 'full_helix',
      completed: true,
      completion_reward: bonuses,
      difficulty
    });
    
    setCompanion(prev => ({ ...prev, ...bonuses }));
    toast.success(`Evolution complete! +${bonuses.experience_points} XP earned!`);
  };

  const handleEvolutionPathSelect = async (pathData) => {
    if (!companion) return;
    
    await base44.entities.Companion.update(companion.id, {
      evolution_path: pathData.evolution_path,
      subtype: pathData.subtype,
      signature_passive: pathData.signature_passive,
      signature_ability: pathData.signature_ability
    });

    setCompanion(prev => ({ ...prev, ...pathData }));
    setShowPathSelector(false);
    toast.success(`${companion.name} chose the ${pathData.evolution_path} path — ${pathData.subtype} specialization!`);
  };

  const canChooseEvolutionPath = companion?.stage === 'teenager' && !companion?.evolution_path;
  
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
                {companion?.evolution_path && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Path</span>
                      <Badge className="bg-violet-100 text-violet-700">{companion.evolution_path}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtype</span>
                      <Badge className="bg-cyan-100 text-cyan-700">{companion.subtype}</Badge>
                    </div>
                  </>
                )}
              </div>

              {/* Signature Abilities */}
              {companion?.signature_passive && (
                <div className="mt-4 p-3 bg-amber-50 rounded-xl">
                  <div className="text-xs text-amber-600 font-semibold mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Passive
                  </div>
                  <p className="text-xs text-amber-700">{companion.signature_passive}</p>
                </div>
              )}
              {companion?.signature_ability && (
                <div className="mt-2 p-3 bg-purple-50 rounded-xl">
                  <div className="text-xs text-purple-600 font-semibold mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Signature
                  </div>
                  <p className="text-xs text-purple-700">{companion.signature_ability}</p>
                </div>
              )}

              {/* Evolution Path CTA */}
              {canChooseEvolutionPath && !isLocked && (
                <Button
                  onClick={() => setShowPathSelector(true)}
                  className="w-full mt-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90"
                  size="sm"
                >
                  <GitBranch className="w-4 h-4 mr-1" />
                  Choose Evolution Path
                </Button>
              )}
            </motion.div>
          </div>
          
          {/* Puzzle Area / Path Selector */}
          <div className="lg:col-span-3">
            {showPathSelector ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
              >
                <EvolutionPathSelector
                  companion={companion}
                  onSelect={handleEvolutionPathSelect}
                />
                <div className="mt-4">
                  <Button variant="outline" onClick={() => setShowPathSelector(false)}>Back to Puzzles</Button>
                </div>
              </motion.div>
            ) : (
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}