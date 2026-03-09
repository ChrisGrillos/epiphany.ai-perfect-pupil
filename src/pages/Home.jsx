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
  TrendingUp,
  Swords,
  Brain
} from 'lucide-react';

import CompanionAvatar from '@/components/companion/CompanionAvatar';
import StatsDisplay from '@/components/companion/StatsDisplay';
import ActionButtons from '@/components/companion/ActionButtons';
import ChatInterface from '@/components/companion/ChatInterface';
import BrainExportPanel from '@/components/companion/BrainExportPanel';

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
    
    if (actionType === 'gift') {
      navigate(createPageUrl('Store'));
      return;
    }
    
    setActionInProgress(true);
    
    const response = await base44.functions.invoke('applyCompanionAction', {
      companion_id: companion.id,
      action_type: actionType
    });

    if (response.data.error) {
      toast.error(response.data.error);
      setActionInProgress(false);
      return;
    }

    setCompanion(response.data.companion);
    toast.success(response.data.response_text);
    setActionInProgress(false);
  };
  
  const handleSendMessage = async (message) => {
    if (!companion) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsTyping(true);
    
    // Use memory-aware companion chat backend
    const response = await base44.functions.invoke('companionChat', {
      companion_id: companion.id,
      message
    });

    setIsTyping(false);

    if (response.data.error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Hmm... I got a little confused. Can you try again?" }]);
      return;
    }

    setChatMessages(prev => [...prev, { 
      role: 'assistant', 
      content: response.data.response,
      emotion: response.data.emotion,
      memoryCreated: response.data.memory_created
    }]);
    
    setCompanion(prev => ({
      ...prev,
      trust_level: Math.min(100, (prev.trust_level || 0) + 1)
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
              onClick={() => navigate(createPageUrl('Battle'))}
              title="Battle Arena"
            >
              <Swords className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(createPageUrl('MemoryManager'))}
              title="Memory Manager"
            >
              <Brain className="w-5 h-5" />
            </Button>
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
                <div className="flex items-center justify-center gap-2 mt-1">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-medium text-violet-600">
                    {companion?.experience_points || 0} XP
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">
                    {companion?.build_archetype || 'Adaptive'} · {companion?.temperament || 'Calm'}
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
              
              <TabsContent value="stats" className="mt-0 space-y-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
                >
                  <h3 className="font-semibold text-slate-800 mb-6">
                    {companion?.name}'s Stats
                  </h3>
                  <StatsDisplay companion={companion} />

                  {/* Identity Summary */}
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="p-3 bg-violet-50 rounded-xl text-center">
                      <div className="text-xs text-violet-500 mb-1">Archetype</div>
                      <div className="text-sm font-bold text-violet-700">{companion?.build_archetype || 'Adaptive'}</div>
                    </div>
                    <div className="p-3 bg-cyan-50 rounded-xl text-center">
                      <div className="text-xs text-cyan-500 mb-1">Frame</div>
                      <div className="text-sm font-bold text-cyan-700">{companion?.body_frame || 'Balanced'}</div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl text-center">
                      <div className="text-xs text-amber-500 mb-1">Temperament</div>
                      <div className="text-sm font-bold text-amber-700">{companion?.temperament || 'Calm'}</div>
                    </div>
                  </div>

                  {/* Bond Level */}
                  <div className="mt-4 p-3 bg-pink-50 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-pink-500">Bond Level</span>
                      <span className="text-xs font-bold text-pink-700">{companion?.bond_level || 0}/100</span>
                    </div>
                    <div className="h-2 bg-pink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-pink-400 rounded-full transition-all"
                        style={{ width: `${companion?.bond_level || 0}%` }}
                      />
                    </div>
                  </div>
                </motion.div>

                <BrainExportPanel companion={companion} subscription={subscription} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
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