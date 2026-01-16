import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  ShoppingBag, 
  Trophy, 
  MessageCircle,
  Sparkles,
  TrendingUp
} from 'lucide-react';

import CompanionAvatar from '@/components/companion/CompanionAvatar';
import StatsDisplay from '@/components/companion/StatsDisplay';
import ActionButtons from '@/components/companion/ActionButtons';
import ChatInterface from '@/components/companion/ChatInterface';

export default function Home() {
  const navigate = useNavigate();
  const [companion, setCompanion] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('care');
  const [chatMessages, setChatMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const [companions, subscriptions] = await Promise.all([
      base44.entities.Companion.list(),
      base44.entities.Subscription.list()
    ]);
    
    if (companions.length === 0) {
      navigate(createPageUrl('Welcome'));
      return;
    }
    
    setCompanion(companions[0]);
    setSubscription(subscriptions[0] || { tier: 'free' });
    setLoading(false);
  };
  
  const handleAction = async (actionType) => {
    if (!companion) return;
    setActionInProgress(true);
    
    let statChanges = {};
    let response = '';
    
    switch (actionType) {
      case 'feed':
        statChanges = {
          hunger: Math.min(100, companion.hunger + 15),
          happiness: Math.min(100, companion.happiness + 5),
          trust_level: Math.min(100, companion.trust_level + 2)
        };
        response = generateFeedResponse(companion);
        break;
        
      case 'exercise':
        statChanges = {
          fitness: Math.min(100, companion.fitness + 10),
          hunger: Math.max(0, companion.hunger - 10),
          happiness: Math.min(100, companion.happiness + 8),
          personality_energy: Math.min(100, companion.personality_energy + 3)
        };
        response = generateExerciseResponse(companion);
        break;
        
      case 'study':
        statChanges = {
          knowledge_level: Math.min(100, companion.knowledge_level + 5),
          happiness: Math.min(100, companion.happiness + 3),
          personality_curiosity: Math.min(100, companion.personality_curiosity + 2)
        };
        response = generateStudyResponse(companion);
        break;
        
      case 'interact':
        statChanges = {
          happiness: Math.min(100, companion.happiness + 10),
          trust_level: Math.min(100, companion.trust_level + 5),
          affection_level: Math.min(100, companion.affection_level + 3),
          personality_empathy: Math.min(100, companion.personality_empathy + 2)
        };
        response = generateInteractResponse(companion);
        break;
        
      case 'gift':
        navigate(createPageUrl('Store'));
        setActionInProgress(false);
        return;
    }
    
    // Update mood based on stats
    const newMood = calculateMood({ ...companion, ...statChanges });
    statChanges.mood = newMood;
    
    // Update companion
    await base44.entities.Companion.update(companion.id, statChanges);
    
    // Log interaction
    await base44.entities.InteractionLog.create({
      companion_id: companion.id,
      action_type: actionType,
      stat_changes: statChanges,
      companion_response: response
    });
    
    setCompanion({ ...companion, ...statChanges });
    toast.success(response);
    setActionInProgress(false);
  };
  
  const handleSendMessage = async (message) => {
    if (!companion) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsTyping(true);
    
    // Use LLM for response
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are ${companion.name}, a ${companion.species} Perfect Pupil companion at the ${companion.stage} stage. 
      
Your personality traits:
- Openness: ${companion.personality_openness}/100
- Curiosity: ${companion.personality_curiosity}/100
- Energy: ${companion.personality_energy}/100
- Empathy: ${companion.personality_empathy}/100
- Agreeableness: ${companion.personality_agreeableness}/100

Your current mood is ${companion.mood}. Your knowledge level is ${companion.knowledge_level}/100.

Respond to this message from your caretaker in character. Be ${companion.stage === 'infant' ? 'very simple, using few words and baby-like speech' : companion.stage === 'child' ? 'curious and playful like a young child' : 'more mature but still learning'}.

Always be honest and emotionally supportive. If you don't know something, say so.

User message: "${message}"`,
      response_json_schema: {
        type: 'object',
        properties: {
          response: { type: 'string' },
          emotion: { type: 'string', enum: ['happy', 'curious', 'thoughtful', 'excited', 'calm'] }
        }
      }
    });
    
    setIsTyping(false);
    setChatMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
    
    // Update companion stats from chat
    await base44.entities.Companion.update(companion.id, {
      trust_level: Math.min(100, companion.trust_level + 1),
      last_interaction: new Date().toISOString()
    });
    
    setCompanion(prev => ({
      ...prev,
      trust_level: Math.min(100, prev.trust_level + 1)
    }));
  };
  
  const handlePuzzleClick = () => {
    navigate(createPageUrl('Evolution'));
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          ✨
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
            <span className="text-2xl">✨</span>
            <div>
              <h1 className="font-bold text-slate-800">Epiphany.AI</h1>
              <p className="text-xs text-slate-500">Perfect Pupil™</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(createPageUrl('Customize'))}
              title="Customize"
            >
              <Sparkles className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(createPageUrl('Store'))}
            >
              <ShoppingBag className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(createPageUrl('Achievements'))}
            >
              <Trophy className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(createPageUrl('Settings'))}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Companion Display */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
            >
              {/* Companion Name & Level */}
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">{companion?.name}</h2>
                <p className="text-sm text-slate-500 capitalize">
                  {companion?.stage} • {companion?.species}
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-medium text-violet-600">
                    {companion?.experience_points || 0} XP
                  </span>
                </div>
              </div>
              
              {/* Avatar */}
              <div className="flex justify-center mb-6">
                <CompanionAvatar companion={companion} size="large" />
              </div>
              
              {/* Mood Indicator */}
              <div className="text-center mb-6">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full">
                  <span className="text-lg">{getMoodEmoji(companion?.mood)}</span>
                  <span className="text-sm font-medium text-slate-600 capitalize">
                    {companion?.mood || 'content'}
                  </span>
                </span>
              </div>
              
              {/* Compact Stats */}
              <StatsDisplay companion={companion} compact />
            </motion.div>
          </div>
          
          {/* Main Interaction Area */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full bg-white border border-slate-200 rounded-xl p-1 mb-4">
                <TabsTrigger value="care" className="flex-1 rounded-lg data-[state=active]:bg-violet-100">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Care
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex-1 rounded-lg data-[state=active]:bg-violet-100">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="stats" className="flex-1 rounded-lg data-[state=active]:bg-violet-100">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Stats
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="care" className="mt-0">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
                >
                  <h3 className="font-semibold text-slate-800 mb-4">
                    Care for {companion?.name}
                  </h3>
                  <ActionButtons
                    companion={companion}
                    subscription={subscription}
                    onAction={handleAction}
                    onPuzzleClick={handlePuzzleClick}
                    disabled={actionInProgress}
                  />
                  
                  {/* Quick Tips */}
                  <div className="mt-6 p-4 bg-violet-50 rounded-xl">
                    <p className="text-sm text-violet-700">
                      💡 <strong>Tip:</strong> Regular feeding, exercise, and interaction help your companion grow and evolve!
                    </p>
                  </div>
                </motion.div>
              </TabsContent>
              
              <TabsContent value="chat" className="mt-0 h-[500px]">
                <ChatInterface
                  companion={companion}
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  isTyping={isTyping}
                  disabled={subscription?.tier === 'free' && chatMessages.length >= 10}
                />
              </TabsContent>
              
              <TabsContent value="stats" className="mt-0">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
                >
                  <h3 className="font-semibold text-slate-800 mb-6">
                    {companion?.name}'s Stats
                  </h3>
                  <StatsDisplay companion={companion} />
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper functions
function generateFeedResponse(companion) {
  const responses = [
    `${companion.name} happily munches on the treat!`,
    `Yummy! ${companion.name} loves it!`,
    `${companion.name}'s tummy is happy now!`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateExerciseResponse(companion) {
  const responses = [
    `${companion.name} bounces around energetically!`,
    `What a workout! ${companion.name} is getting stronger!`,
    `${companion.name} loves playtime!`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateStudyResponse(companion) {
  const responses = [
    `${companion.name} learned something new today!`,
    `${companion.name}'s curiosity is growing!`,
    `Knowledge is power! ${companion.name} is getting smarter!`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateInteractResponse(companion) {
  const responses = [
    `${companion.name} feels so loved!`,
    `Your bond with ${companion.name} grows stronger!`,
    `${companion.name} appreciates the attention!`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function calculateMood(companion) {
  const avgStats = (companion.hunger + companion.happiness + companion.fitness) / 3;
  
  if (avgStats >= 80) return 'joyful';
  if (avgStats >= 60) return 'content';
  if (avgStats >= 40) return 'neutral';
  if (companion.hunger < 30) return 'tired';
  if (companion.happiness < 30) return 'sad';
  return 'neutral';
}

function getMoodEmoji(mood) {
  const emojis = {
    joyful: '✨',
    content: '😊',
    neutral: '😐',
    sad: '😢',
    tired: '😴',
    excited: '🎉',
    curious: '🤔'
  };
  return emojis[mood] || '💜';
}