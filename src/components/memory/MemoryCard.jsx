import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Brain, Star, Clock, ChevronDown, ChevronUp, 
  Trash2, BookOpen, Heart, Zap, Lightbulb, Calendar
} from 'lucide-react';

const TYPE_CONFIG = {
  fact: { icon: BookOpen, color: 'bg-blue-100 text-blue-700', label: 'Fact' },
  preference: { icon: Heart, color: 'bg-pink-100 text-pink-700', label: 'Preference' },
  event: { icon: Calendar, color: 'bg-amber-100 text-amber-700', label: 'Event' },
  emotion: { icon: Zap, color: 'bg-purple-100 text-purple-700', label: 'Emotion' },
  skill: { icon: Lightbulb, color: 'bg-emerald-100 text-emerald-700', label: 'Skill' }
};

export default function MemoryCard({ memory, onUpdate, onDelete, onAddTag }) {
  const [expanded, setExpanded] = useState(false);
  const [editingImportance, setEditingImportance] = useState(false);

  const typeConfig = TYPE_CONFIG[memory.memory_type] || TYPE_CONFIG.fact;
  const TypeIcon = typeConfig.icon;

  const handleImportanceChange = (value) => {
    onUpdate(memory.id, { importance: value[0] });
    setEditingImportance(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${typeConfig.color} flex-shrink-0`}>
            <TypeIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-slate-800 text-sm truncate">{memory.memory_key}</h4>
            <p className="text-sm text-slate-600 mt-1">{memory.memory_value}</p>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={typeConfig.color}>
                {typeConfig.label}
              </Badge>
              <Badge variant="outline" className="text-amber-600 border-amber-200">
                <Star className="w-3 h-3 mr-1" />
                {memory.importance || 50}
              </Badge>
              {memory.recall_count > 0 && (
                <Badge variant="outline" className="text-slate-500">
                  <Brain className="w-3 h-3 mr-1" />
                  Recalled {memory.recall_count}x
                </Badge>
              )}
            </div>

            {(memory.tags || []).length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {memory.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-4 pt-4 border-t border-slate-100 space-y-4"
        >
          {/* Importance Slider */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">
              Importance (affects how often this memory is recalled)
            </label>
            <Slider
              defaultValue={[memory.importance || 50]}
              max={100}
              min={1}
              step={1}
              onValueCommit={handleImportanceChange}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Add Tag */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">Add Tag</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type a tag..."
                className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    onAddTag(memory.id, e.target.value.trim());
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          {/* Meta info */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {memory.last_recalled ? `Last recalled: ${new Date(memory.last_recalled).toLocaleDateString()}` : 'Never recalled'}
            </div>
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => onDelete(memory.id)}>
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}