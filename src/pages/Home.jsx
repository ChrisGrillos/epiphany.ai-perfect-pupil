import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { pupil } from '@/api/pupilClient';
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
  Brain,
  BarChart3
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
  const [sessionId, setSessionId] = useState(null);
  const [chatError, setChatError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [trainingAllowed, setTrainingAllowed] = useState(false);
  const controllerRef = useRef(null);
  const sendingRef = useRef(false);
  
  useEffect(() => {
    loadData().catch(error => { setLoadError(error.message); setLoading(false); });
    return () => controllerRef.current?.abort();
  }, []);
  
  const loadData = async () => {
    const [companions, subscriptions, entitlementResponse] = await Promise.all([
      pupil.entities.Companion.list(),
      pupil.entities.Subscription.list(),
      pupil.functions.invoke('getEntitlements', {})
    ]);
    
    if (companions.length === 0) {
      navigate(createPageUrl('Welcome'));
      return;
    }
    
    setCompanion(companions[0]);
    const entitlementTier = entitlementResponse?.data?.tier;
    setSubscription(entitlementTier ? { tier: entitlementTier } : (subscriptions[0] || { tier: 'free' }));
    const sessions = await pupil.entities.ChatSession.filter({ companion_id: companions[0].id, is_imported: false }, '-updated_date', 1);
    if (sessions[0]) {
      setSessionId(sessions[0].id);
      const messages = await pupil.entities.ChatMessage.filter({ session_id: sessions[0].id });
      setChatMessages(messages.map(m => ({ ...m, emotion: m.emotion_tag })));
    }
    setLoading(false);
  };
  
  const handleAction = async (actionType) => {
    if (!companion) return;
    
    if (actionType === 'gift') {
      navigate(createPageUrl('Store'));
      return;
    }
    
    setActionInProgress(true);
    
    const response = await pupil.functions.invoke('applyCompanionAction', {
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

    // Phase 5: Check achievements after care action
    pupil.functions.invoke('checkAchievements', { companion_id: companion.id }).then(res => {
      if (res.data?.newly_unlocked?.length > 0) {
        res.data.newly_unlocked.forEach(a => {
          toast.success(`🏆 Achievement Unlocked: ${a.key.replace(/_/g, ' ')} (+${a.xp} XP)`);
        });
      }
    });
  };
  
  const handleSendMessage = async (message) => {
    if (!companion || sendingRef.current) return;
    sendingRef.current = true;
    const controller = new AbortController(); controllerRef.current = controller;
    setChatError(''); setIsTyping(true);
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    try {
      const { data } = await pupil.functions.invoke('companionChat', {
        companion_id: companion.id, message, ...(sessionId ? { session_id: sessionId } : {}),
        request_id: crypto.randomUUID(), training_allowed: trainingAllowed,
      }, { signal: controller.signal });
      if (data.error) throw new Error(data.error);
      setSessionId(data.session_id);
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response, emotion: data.emotion, provider: data.provider, model: data.model, fallback: data.fallback, response_source: data.response_source, suggested_memory: data.suggested_memory }]);
      setCompanion(prev => ({ ...prev, trust_level: Math.min(100, (prev.trust_level || 0) + 1) }));
    } catch (error) { setChatError(error.name === 'AbortError' ? 'Generation stopped. Reload to check whether the response was saved.' : error.message); }
    finally { sendingRef.current = false; setIsTyping(false); }
  };
  const newConversation = async () => {
    const { data } = await pupil.functions.invoke('newChatSession', { companion_id: companion.id });
    if (data.error) return toast.error(data.error);
    setSessionId(data.id); setChatMessages([]); setChatError('');
  };
  const saveSuggestedMemory = async (memory, index) => {
    try {
      await pupil.entities.CompanionMemory.create({ companion_id: companion.id, memory_key: memory.key, memory_value: memory.value, memory_type: memory.type, importance: memory.importance, tags: memory.tags });
      setChatMessages(prev => prev.map((m, i) => i === index ? { ...m, suggested_memory: null } : m));
      toast.success('Memory saved');
    } catch (error) { toast.error(error.message); }
  };

  const handlePuzzleClick = () => {
    navigate(createPageUrl('Evolution'));
  };
  
  if (loadError) return <main role="alert" className="p-10"><p>{loadError}</p><Button onClick={() => window.location.reload()}>Reload</Button></main>;
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
              onClick={() => navigate(createPageUrl('CompanionDashboard'))}
              title="Dashboard"
            >
              <BarChart3 className="w-5 h-5" />
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
              
              <TabsContent value="chat" className="mt-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Button variant="outline" size="sm" onClick={() => navigate('/AISettings')}>Model settings</Button>
                  <Button variant="outline" size="sm" onClick={newConversation} disabled={isTyping}>New conversation</Button>
                  {isTyping && <Button variant="outline" size="sm" onClick={() => controllerRef.current?.abort()}>Stop</Button>}
                </div>
                <label className="flex gap-2 text-xs text-slate-500"><input type="checkbox" checked={trainingAllowed} onChange={e => setTrainingAllowed(e.target.checked)} />Allow these messages and their context for optional training review. Nothing trains automatically.</label>
                {chatError && <p role="alert" className="text-sm text-red-700">{chatError}</p>}
                <div className="h-[500px]">
                <ChatInterface
                  companion={companion}
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  isTyping={isTyping}
                  onSaveMemory={saveSuggestedMemory}
                />
                </div>
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
