import React from 'react';
import { motion } from 'framer-motion';
import { Baby, GraduationCap, User, Sparkles } from 'lucide-react';

const STAGES = [
  {
    id: 'infant',
    name: 'Infant',
    icon: Baby,
    color: 'from-rose-400 to-pink-500',
    description: 'Start from the very beginning',
    details: [
      'Knows almost nothing',
      'Barely speaks - must be taught',
      'Maximum bonding potential',
      'Learn basics together'
    ],
    difficulty: 'Challenging but rewarding'
  },
  {
    id: 'child',
    name: 'Young Child',
    icon: Sparkles,
    color: 'from-violet-400 to-purple-500',
    description: 'Already learned the basics',
    details: [
      'Ages 7-8 equivalent knowledge',
      'Basic language & math',
      'Partial personality formed',
      'Eager to learn more'
    ],
    difficulty: 'Balanced experience'
  },
  {
    id: 'teenager',
    name: 'Teenager',
    icon: GraduationCap,
    color: 'from-cyan-400 to-teal-500',
    description: 'Ready for advanced learning',
    details: [
      'High school knowledge',
      'Formed personality',
      'Direct profession learning',
      'Internet-sourced education'
    ],
    difficulty: 'Focused on growth'
  }
];

export default function StageSelector({ selectedStage, onSelect }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Choose Starting Stage
        </h2>
        <p className="text-slate-500">
          Select how developed your Perfect Pupil will be at the start
        </p>
      </div>
      
      <div className="grid gap-4">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isSelected = selectedStage === stage.id;
          
          return (
            <motion.button
              key={stage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelect(stage.id)}
              className={`
                relative p-6 rounded-2xl text-left transition-all duration-300
                ${isSelected 
                  ? 'bg-white border-2 border-violet-500 shadow-lg shadow-violet-100' 
                  : 'bg-white border-2 border-slate-200 hover:border-slate-300'
                }
              `}
            >
              <div className="flex gap-4">
                {/* Icon */}
                <div className={`
                  w-14 h-14 rounded-xl bg-gradient-to-br ${stage.color}
                  flex items-center justify-center flex-shrink-0
                `}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-lg text-slate-800">{stage.name}</h3>
                    <span className="text-xs text-slate-400">{stage.difficulty}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{stage.description}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {stage.details.map((detail, i) => (
                      <span 
                        key={i}
                        className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full"
                      >
                        {detail}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Selection Indicator */}
              {isSelected && (
                <motion.div
                  layoutId="stage-selector"
                  className="absolute inset-0 border-2 border-violet-500 rounded-2xl pointer-events-none"
                  initial={false}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}