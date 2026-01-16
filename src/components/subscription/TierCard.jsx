import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Crown, Sparkles } from 'lucide-react';

const TIER_CONFIG = {
  free: {
    name: 'Free',
    price: 0,
    icon: Star,
    color: 'from-slate-400 to-slate-500',
    features: [
      'View companion stats',
      'Basic interactions',
      'Limited chat (10/day)',
      'View store items'
    ],
    limitations: [
      'No purchases',
      'No evolution control',
      'No mini-games'
    ]
  },
  basic: {
    name: 'Basic',
    price: 0.99,
    icon: Star,
    color: 'from-violet-500 to-purple-600',
    features: [
      'Full care & interaction',
      'Unlimited chat',
      'Store access',
      'Basic items & treats',
      'Achievement tracking',
      'All stage options'
    ],
    popular: true
  },
  premium: {
    name: 'Premium',
    price: 4.99,
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    features: [
      'Everything in Basic',
      'Evolution control',
      'Form & shape customization',
      'Color palette editor',
      'Premium cosmetics',
      'Priority AI responses'
    ]
  },
  elite: {
    name: 'Elite',
    price: 9.99,
    icon: Sparkles,
    color: 'from-rose-500 to-pink-600',
    features: [
      'Everything in Premium',
      'DNA Evolution Puzzles',
      'Advanced personalization',
      'Exclusive abilities',
      'Early access features',
      'Direct trait influence',
      'Custom themes'
    ]
  }
};

export default function TierCard({ 
  tier, 
  isCurrentTier = false, 
  onSelect, 
  isProcessing = false 
}) {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;
  
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      className={`
        relative bg-white rounded-3xl border-2 overflow-hidden
        ${isCurrentTier ? 'border-violet-500 shadow-lg shadow-violet-100' : 'border-slate-200'}
        ${config.popular ? 'ring-2 ring-violet-500 ring-offset-4' : ''}
      `}
    >
      {/* Popular Badge */}
      {config.popular && (
        <div className="absolute -top-px left-1/2 -translate-x-1/2">
          <Badge className="bg-violet-600 text-white rounded-t-none rounded-b-lg">
            Most Popular
          </Badge>
        </div>
      )}
      
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.color} p-6 text-white`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold">{config.name}</h3>
        </div>
        
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">
            {config.price === 0 ? 'Free' : `$${config.price}`}
          </span>
          {config.price > 0 && (
            <span className="text-white/80 text-sm">/month</span>
          )}
        </div>
      </div>
      
      {/* Features */}
      <div className="p-6">
        <ul className="space-y-3 mb-6">
          {config.features.map((feature, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3 text-sm"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              <span className="text-slate-700">{feature}</span>
            </motion.li>
          ))}
          
          {config.limitations?.map((limitation, index) => (
            <li
              key={`limit-${index}`}
              className="flex items-center gap-3 text-sm text-slate-400"
            >
              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs">✕</span>
              </div>
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
        
        <Button
          onClick={() => onSelect(tier)}
          disabled={isCurrentTier || isProcessing}
          className={`
            w-full py-6 rounded-xl font-semibold text-base
            ${isCurrentTier 
              ? 'bg-slate-100 text-slate-500 cursor-default' 
              : `bg-gradient-to-r ${config.color} hover:opacity-90 text-white`
            }
          `}
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : isCurrentTier ? (
            'Current Plan'
          ) : (
            `Get ${config.name}`
          )}
        </Button>
      </div>
    </motion.div>
  );
}