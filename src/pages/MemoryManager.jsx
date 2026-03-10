import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Brain, Shield, Sparkles, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import MemoryCard from '@/components/memory/MemoryCard';
import MemoryFilters from '@/components/memory/MemoryFilters';
import BehaviorRuleEditor from '@/components/memory/BehaviorRuleEditor';

export default function MemoryManager() {
  const navigate = useNavigate();
  const [companion, setCompanion] = useState(null);
  const [memories, setMemories] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('memories');
  const [filter, setFilter] = useState({ search: '', type: 'all', sort: 'importance' });
  const [showCreateMemory, setShowCreateMemory] = useState(false);
  const [newMemory, setNewMemory] = useState({ key: '', value: '', type: 'fact', importance: 50 });

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

    const [mems, rls] = await Promise.all([
      base44.entities.CompanionMemory.filter({ companion_id: comp.id }),
      base44.entities.BehaviorRule.filter({ companion_id: comp.id })
    ]);

    setMemories(mems || []);
    setRules(rls || []);
    setLoading(false);
  };

  // Memory CRUD
  const handleUpdateMemory = async (id, data) => {
    await base44.entities.CompanionMemory.update(id, data);
    setMemories(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
    toast.success('Memory updated');
  };

  const handleDeleteMemory = async (id) => {
    await base44.entities.CompanionMemory.delete(id);
    setMemories(prev => prev.filter(m => m.id !== id));
    toast.success('Memory deleted');
  };

  const handleAddTag = async (id, tag) => {
    const mem = memories.find(m => m.id === id);
    if (!mem) return;
    const tags = [...(mem.tags || []), tag];
    await handleUpdateMemory(id, { tags });
  };

  const handleCreateMemory = async () => {
    if (!newMemory.key.trim() || !newMemory.value.trim()) return;
    const created = await base44.entities.CompanionMemory.create({
      companion_id: companion.id,
      memory_key: newMemory.key,
      memory_value: newMemory.value,
      memory_type: newMemory.type,
      importance: newMemory.importance,
      source: 'notepad',
      tags: [],
      is_encrypted: true
    });
    setMemories(prev => [created, ...prev]);
    setNewMemory({ key: '', value: '', type: 'fact', importance: 50 });
    setShowCreateMemory(false);
    toast.success('Memory created');
  };

  // Behavior Rule CRUD
  const handleCreateRule = async (ruleData) => {
    const created = await base44.entities.BehaviorRule.create({
      companion_id: companion.id,
      ...ruleData,
      is_active: true,
      trigger_count: 0
    });
    setRules(prev => [created, ...prev]);
    toast.success('Behavior rule created');
  };

  const handleUpdateRule = async (id, data) => {
    await base44.entities.BehaviorRule.update(id, data);
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
    toast.success('Rule updated');
  };

  const handleDeleteRule = async (id) => {
    await base44.entities.BehaviorRule.delete(id);
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success('Rule deleted');
  };

  // Filtering & Sorting
  const filteredMemories = memories
    .filter(m => {
      if (filter.type !== 'all' && m.memory_type !== filter.type) return false;
      if (filter.search && !m.memory_key.toLowerCase().includes(filter.search.toLowerCase()) && 
          !m.memory_value.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (filter.sort === 'importance') return (b.importance || 0) - (a.importance || 0);
      if (filter.sort === 'recent') return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      if (filter.sort === 'recalled') return (b.recall_count || 0) - (a.recall_count || 0);
      return 0;
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="text-5xl">
          🧠
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Home'))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-slate-800 flex items-center gap-2">
                <Brain className="w-5 h-5 text-violet-500" />
                Memory Manager
              </h1>
              <p className="text-xs text-slate-500">{companion?.name}'s mind — {memories.length} memories, {rules.length} rules</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-white border border-slate-200 rounded-xl p-1 mb-6">
            <TabsTrigger value="memories" className="flex-1 rounded-lg data-[state=active]:bg-violet-100">
              <Brain className="w-4 h-4 mr-2" />
              Memories ({filteredMemories.length})
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex-1 rounded-lg data-[state=active]:bg-violet-100">
              <Shield className="w-4 h-4 mr-2" />
              Behavior Rules ({rules.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="memories" className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <MemoryFilters filter={filter} onFilterChange={setFilter} />
            </div>

            {/* Create Memory Button */}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowCreateMemory(!showCreateMemory)} className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-1" />
                Add Memory
              </Button>
            </div>

            {/* Create Memory Form */}
            <AnimatePresence>
              {showCreateMemory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-violet-50 rounded-xl p-4 border border-violet-200 space-y-3"
                >
                  <input
                    placeholder="Memory key (e.g., 'favorite_food')"
                    value={newMemory.key}
                    onChange={(e) => setNewMemory({ ...newMemory, key: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  <input
                    placeholder="Memory value (e.g., 'User loves pizza')"
                    value={newMemory.value}
                    onChange={(e) => setNewMemory({ ...newMemory, value: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  <div className="flex gap-3">
                   <Select
                     value={newMemory.type}
                     onValueChange={(val) => setNewMemory({ ...newMemory, type: val })}
                   >
                     <SelectTrigger className="w-36 text-sm">
                       <SelectValue placeholder="Type" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="fact">Fact</SelectItem>
                       <SelectItem value="preference">Preference</SelectItem>
                       <SelectItem value="event">Event</SelectItem>
                       <SelectItem value="emotion">Emotion</SelectItem>
                       <SelectItem value="skill">Skill</SelectItem>
                     </SelectContent>
                   </Select>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Importance: {newMemory.importance}</label>
                      <input
                        type="range"
                        min="1" max="100"
                        value={newMemory.importance}
                        onChange={(e) => setNewMemory({ ...newMemory, importance: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowCreateMemory(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleCreateMemory} className="bg-violet-600 hover:bg-violet-700">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Create
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Memory List */}
            {filteredMemories.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {memories.length === 0 
                    ? "No memories yet. Chat with your companion to create them, or add one manually."
                    : "No memories match your filters."
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredMemories.map(memory => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      onUpdate={handleUpdateMemory}
                      onDelete={handleDeleteMemory}
                      onAddTag={handleAddTag}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="rules">
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <BehaviorRuleEditor
                rules={rules}
                onCreate={handleCreateRule}
                onUpdate={handleUpdateRule}
                onDelete={handleDeleteRule}
              />
            </div>

            {/* Info Panel */}
            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-amber-800 text-sm">How Behavior Rules Work</h4>
                  <p className="text-xs text-amber-700 mt-1">
                    Rules tell your companion how to behave during conversations and interactions. 
                    Higher priority rules override lower ones. Your companion's AI will follow these 
                    rules alongside its natural personality traits and temperament.
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    <strong>Examples:</strong> "When I'm feeling down, be extra supportive and gentle" • 
                    "Always ask about my day before anything else" • "Never discuss politics"
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}