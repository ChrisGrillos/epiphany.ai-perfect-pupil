import React from 'react';
import { motion } from 'framer-motion';

const SPECIES = [
  {
    id: 'celestial',
    name: 'Celestial',
    description: 'A star-born entity of light and wonder',
    colors: ['#9b87f5', '#7dd3c0', '#fbbf24'],
    traits: ['Curious', 'Dreamy', 'Wise'],
    element: '✨'
  },
  {
    id: 'aquatic',
    name: 'Aquatic',
    description: 'A flowing creature of depth and calm',
    colors: ['#06b6d4', '#3b82f6', '#a855f7'],
    traits: ['Calm', 'Adaptive', 'Mysterious'],
    element: '🌊'
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'A nature spirit of growth and harmony',
    colors: ['#22c55e', '#84cc16', '#eab308'],
    traits: ['Nurturing', 'Grounded', 'Playful'],
    element: '🌿'
  },
  {
    id: 'crystal',
    name: 'Crystal',
    description: 'A geometric being of clarity and focus',
    colors: ['#ec4899', '#8b5cf6', '#06b6d4'],
    traits: ['Logical', 'Precise', 'Reflective'],
    element: '💎'
  },
  {
    id: 'shadow',
    name: 'Shadow',
    description: 'An ethereal wisp of mystery and intuition',
    colors: ['#6366f1', '#8b5cf6', '#f43f5e'],
    traits: ['Intuitive', 'Mysterious', 'Empathetic'],
    element: '🌙'
  }
];

export default function SpeciesSelector({ selectedSpecies, onSelect }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Choose Your Species
        </h2>
        <p className="text-slate-500">
          Each species has unique traits and evolution paths
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SPECIES.map((species, index) => {
          const isSelected = selectedSpecies === species.id;
          
          return (
            <motion.button
              key={species.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(species.id)}
              className={`
                relative p-5 rounded-2xl text-left transition-all duration-300
                ${isSelected 
                  ? 'bg-white border-2 border-violet-500 shadow-lg shadow-violet-100' 
                  : 'bg-white border-2 border-slate-200 hover:border-slate-300'
                }
              `}
            >
              {/* Color Preview */}
              <div className="flex gap-2 mb-4">
                {species.colors.map((color, i) => (
                  <motion.div
                    key={i}
                    animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                    className="w-8 h-8 rounded-full shadow-md"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              
              {/* Element Emoji */}
              <div className="absolute top-4 right-4 text-2xl">
                {species.element}
              </div>
              
              {/* Info */}
              <h3 className="font-bold text-lg text-slate-800 mb-1">
                {species.name}
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                {species.description}
              </p>
              
              {/* Traits */}
              <div className="flex flex-wrap gap-1.5">
                {species.traits.map((trait, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ 
                      backgroundColor: species.colors[i % species.colors.length] + '20',
                      color: species.colors[i % species.colors.length]
                    }}
                  >
                    {trait}
                  </span>
                ))}
              </div>
              
              {/* Selection Ring */}
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 rounded-2xl ring-2 ring-violet-500 ring-offset-2 pointer-events-none"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}