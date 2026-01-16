import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, Brain, Cpu } from 'lucide-react';

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
    const [companions, subs, mems, rules, algStates] = await Promise.all([
      base44.entities.Companion.list(),
      base44.entities.Subscription.list(),
      base44.entities.CompanionMemory.list(),
      base44.entities.BehaviorRule.list(),
      base44.entities.AlgorithmState.list()
    ]);
    
    if (companions.length === 0) {
      navigate(createPageUrl('Welcome'));
      return;
    }
    
    setCompanion(companions[0]);
    setSubscription(subs[0] || { tier: 'free' });
    setMemories(mems);
    setBehaviorRules(rules);
    setAlgorithmState(algStates[0]);
    setLoading(false);
  };
  
  const handleParseNotepad = async (content) => {
    // Use LLM to parse natural language into structured data
    const parseResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a behavior parser for an AI companion. Extract structured customization data from the following natural language input.

Input: "${content}"

Extract and return:
1. Personality traits (e.g., {name: "wit", value: 75} where value is 0-100)
2. Memories (key-value pairs like {key: "favorite_color", value: "blue"})
3. Behavior rules (conditions and actions, e.g., {name: "morning_greeting", description: "Be extra cheerful in morning", condition: "time_is_morning", action: "use_cheerful_tone"})

Be specific and actionable. If the input is vague, make reasonable interpretations.`,
      response_json_schema: {
        type: 'object',
        properties: {
          traits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' }
              }
            }
          },
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                value: { type: 'string' },
                type: { type: 'string', enum: ['fact', 'preference', 'event', 'emotion', 'skill'] }
              }
            }
          },
          rules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                condition: { type: 'string' },
                action: { type: 'string' },
                priority: { type: 'number' }
              }
            }
          }
        }
      }
    });
    
    // Store the parsed data
    if (parseResult.memories && parseResult.memories.length > 0) {
      for (const memory of parseResult.memories) {
        await base44.entities.CompanionMemory.create({
          companion_id: companion.id,
          memory_key: memory.key,
          memory_value: memory.value,
          memory_type: memory.type || 'fact',
          importance: 70,
          source: 'notepad',
          is_encrypted: true,
          tags: []
        });
      }
    }
    
    if (parseResult.rules && parseResult.rules.length > 0) {
      for (const rule of parseResult.rules) {
        await base44.entities.BehaviorRule.create({
          companion_id: companion.id,
          rule_name: rule.name,
          rule_description: rule.description,
          condition: rule.condition,
          action: rule.action,
          priority: rule.priority || 50,
          is_active: true,
          parsed_metadata: rule
        });
      }
    }
    
    if (parseResult.traits && parseResult.traits.length > 0) {
      const traitUpdates = {};
      for (const trait of parseResult.traits) {
        // Map trait names to companion personality fields
        const traitMap = {
          'wit': 'personality_openness',
          'witty': 'personality_openness',
          'calm': 'personality_agreeableness',
          'patient': 'personality_agreeableness',
          'curious': 'personality_curiosity',
          'energetic': 'personality_energy',
          'empathetic': 'personality_empathy',
          'supportive': 'personality_empathy'
        };
        
        const field = traitMap[trait.name.toLowerCase()];
        if (field) {
          traitUpdates[field] = Math.min(100, Math.max(0, trait.value));
        }
      }
      
      if (Object.keys(traitUpdates).length > 0) {
        await base44.entities.Companion.update(companion.id, traitUpdates);
        setCompanion(prev => ({ ...prev, ...traitUpdates }));
      }
    }
    
    // Refresh data
    const [newMems, newRules] = await Promise.all([
      base44.entities.CompanionMemory.list(),
      base44.entities.BehaviorRule.list()
    ]);
    
    setMemories(newMems);
    setBehaviorRules(newRules);
    
    return parseResult;
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