import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Trash2, Zap, Shield, ChevronDown, ChevronUp,
  AlertTriangle, BookOpen
} from 'lucide-react';

export default function BehaviorRuleEditor({ rules, onCreate, onUpdate, onDelete }) {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [newRule, setNewRule] = useState({
    rule_name: '',
    rule_description: '',
    condition: '',
    action: '',
    priority: 50
  });

  const handleCreate = () => {
    if (!newRule.rule_name.trim() || !newRule.rule_description.trim()) return;
    onCreate(newRule);
    setNewRule({ rule_name: '', rule_description: '', condition: '', action: '', priority: 50 });
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-500" />
            Behavior Rules
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Define rules your companion must follow during interactions
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-1" />
          New Rule
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-violet-50 rounded-xl p-4 border border-violet-200 space-y-3"
          >
            <Input
              placeholder="Rule name (e.g., 'Morning Greeting')"
              value={newRule.rule_name}
              onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
            />
            <Input
              placeholder="Describe the rule in plain English..."
              value={newRule.rule_description}
              onChange={(e) => setNewRule({ ...newRule, rule_description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="When... (e.g., 'user says good morning')"
                value={newRule.condition}
                onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
              />
              <Input
                placeholder="Then do... (e.g., 'respond enthusiastically')"
                value={newRule.action}
                onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Priority: {newRule.priority}</label>
              <Slider
                value={[newRule.priority]}
                onValueChange={(v) => setNewRule({ ...newRule, priority: v[0] })}
                max={100} min={1} step={1}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} className="bg-violet-600 hover:bg-violet-700">Create Rule</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules List */}
      {(!rules || rules.length === 0) ? (
        <div className="text-center py-8 text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No behavior rules yet. Create one to guide your companion's behavior.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.sort((a, b) => (b.priority || 0) - (a.priority || 0)).map(rule => (
            <motion.div
              key={rule.id}
              layout
              className="bg-white rounded-xl border border-slate-200 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Switch
                    checked={rule.is_active !== false}
                    onCheckedChange={(checked) => onUpdate(rule.id, { is_active: checked })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${rule.is_active !== false ? 'text-slate-800' : 'text-slate-400'}`}>
                        {rule.rule_name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        P{rule.priority || 50}
                      </Badge>
                      {rule.trigger_count > 0 && (
                        <Badge variant="outline" className="text-xs text-emerald-600">
                          <Zap className="w-2.5 h-2.5 mr-0.5" />
                          {rule.trigger_count}x
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{rule.rule_description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}>
                    {expandedId === rule.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => onDelete(rule.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === rule.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 pt-3 border-t border-slate-100 space-y-2"
                  >
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-slate-400 block mb-1">When:</span>
                        <span className="text-slate-700">{rule.condition || 'Always'}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-slate-400 block mb-1">Then:</span>
                        <span className="text-slate-700">{rule.action || 'No specific action'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Priority: {rule.priority || 50}</label>
                      <Slider
                        defaultValue={[rule.priority || 50]}
                        onValueCommit={(v) => onUpdate(rule.id, { priority: v[0] })}
                        max={100} min={1} step={1}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}