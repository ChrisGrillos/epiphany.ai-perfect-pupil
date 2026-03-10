import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Zap, Brain, Smile, Dumbbell } from 'lucide-react';

const STAT_CONFIG = {
  hunger: {
    icon: Heart,
    label: 'Hunger',
    color: 'bg-rose-500',
    bgColor: 'bg-rose-100',
    description: 'How full your companion is'
  },
  happiness: {
    icon: Smile,
    label: 'Happiness',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-100',
    description: 'Overall mood and contentment'
  },
  fitness: {
    icon: Dumbbell,
    label: 'Fitness',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    description: 'Physical health and energy'
  },
  knowledge_level: {
    icon: Brain,
    label: 'Knowledge',
    color: 'bg-violet-500',
    bgColor: 'bg-violet-100',
    description: 'Learning and intelligence'
  },
  trust_level: {
    icon: Zap,
    label: 'Trust',
    color: 'bg-cyan-500',
    bgColor: 'bg-cyan-100',
    description: 'Bond with you'
  }
};

export default function StatsDisplay({ companion, compact = false }) {
  if (!companion) return null;
  
  const stats = ['hunger', 'happiness', 'fitness', 'knowledge_level', 'trust_level'];
  
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {stats.map(stat => {
          const config = STAT_CONFIG[stat];
          const Icon = config.icon;
          const value = companion[stat] || 0;
          
          return (
            <div key={stat} className="flex items-center gap-1.5" title={`${config.label}: ${value}%`}>
              <div className={`p-1 rounded-md ${config.bgColor}`}>
                <Icon className="w-3.5 h-3.5" style={{ color: config.color.replace('bg-', '#').replace('-500', '') }} />
              </div>
              <span className="text-xs font-medium text-slate-600">{value}</span>
            </div>
          );
        })}
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {stats.map((stat, index) => {
        const config = STAT_CONFIG[stat];
        const Icon = config.icon;
        const value = companion[stat] || 0;
        
        return (
          <motion.div
            key={stat}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                  <Icon className="w-4 h-4 text-slate-700" />
                </div>
                <span className="text-sm font-medium text-slate-700">{config.label}</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">{value}%</span>
            </div>
            
            <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${config.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            
            <p className="text-xs text-slate-500">{config.description}</p>
          </motion.div>
        );
      })}
    </div>
  );
}