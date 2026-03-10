import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, Brain } from 'lucide-react';

import NotepadEditor from '@/components/customization/NotepadEditor';
import AlgorithmVisualizer from '@/components/algorithm/AlgorithmVisualizer';

export default function Customize() {
  const navigate = useNavigate();
  const [companion, setCompanion] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [memories, setMemories] = useState([]);
  const [behaviorRules, setBehaviorRules] = useState([]);
  const [algorithmState, setAlgorithmState] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const [companions, subs, mems, rules, algStates, entitlementResponse] = await Promise.all([
      base44.entities.Companion.list(),
      base44.entities.Subscription.list(),
      base44.entities.CompanionMemory.list(),
      base44.entities.BehaviorRule.list(),
      base44.entities.AlgorithmState.list(),
      base44.functions.invoke('getEntitlements', {})
    ]);
    
    if (companions.length === 0) {
      navigate(createPageUrl('Welcome'));
      return;
    }
    
    const entitlementTier = entitlementResponse?.data?.tier;
    setCompanion(companions[0]);
    setSubscription(entitlementTier ? { tier: entitlementTier } : (subs[0] || { tier: 'free' }));
    setMemories(mems);
    setBehaviorRules(rules);
    setAlgorithmState(algStates[0]);
    setLoading(false);
  };
  
  const handleParseNotepad = async (content) => {
    const response = await base44.functions.invoke('applyNotepadCustomization', {
      companion_id: companion?.id,
      content
    });
    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    const [newMems, newRules, refreshedCompanions] = await Promise.all([
      base44.entities.CompanionMemory.list(),
      base44.entities.BehaviorRule.list(),
      base44.entities.Companion.list()
    ]);

    setMemories(newMems || []);
    setBehaviorRules(newRules || []);
    if (Array.isArray(refreshedCompanions) && refreshedCompanions.length > 0) {
      setCompanion(refreshedCompanions[0]);
    }

    return response.data?.parsed || {};
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          ⚙️
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Home'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-slate-800">Customization</h1>
            <p className="text-xs text-slate-500">
              Teach {companion?.name} how to behave and what to remember
            </p>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs defaultValue="notepad" className="w-full">
          <TabsList className="w-full bg-white border border-slate-200 rounded-xl p-1 mb-6">
            <TabsTrigger value="notepad" className="flex-1 rounded-lg data-[state=active]:bg-violet-100">
              <FileText className="w-4 h-4 mr-2" />
              Notepad
            </TabsTrigger>
            <TabsTrigger value="algorithm" className="flex-1 rounded-lg data-[state=active]:bg-violet-100">
              <Brain className="w-4 h-4 mr-2" />
              Algorithm
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="notepad">
            <NotepadEditor
              companion={companion}
              subscription={subscription}
              onParse={handleParseNotepad}
              existingMemories={memories}
              existingRules={behaviorRules}
            />
          </TabsContent>
          
          <TabsContent value="algorithm">
            <AlgorithmVisualizer
              algorithmState={algorithmState}
              companion={companion}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
