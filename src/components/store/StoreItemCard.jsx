import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cookie, Pill, Palette, Sparkles, Gift, Lock } from 'lucide-react';

const CATEGORY_ICONS = {
  treat: Cookie,
  vitamin: Pill,
  cosmetic: Palette,
  theme: Sparkles,
  special: Gift
};

const RARITY_COLORS = {
  common: 'bg-slate-100 text-slate-700 border-slate-200',
  uncommon: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rare: 'bg-violet-50 text-violet-700 border-violet-200',
  legendary: 'bg-amber-50 text-amber-700 border-amber-200'
};

export default function StoreItemCard({ 
  item, 
  onPurchase, 
  userTier = 'free',
  isPurchasing = false 
}) {
  const Icon = CATEGORY_ICONS[item.category] || Gift;
  
  const tierOrder = ['free', 'basic', 'premium', 'elite'];
  const canPurchase = tierOrder.indexOf(userTier) >= tierOrder.indexOf(item.required_tier || 'basic');
  
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
    >
      {/* Item Image/Icon */}
      <div 
        className="relative h-32 flex items-center justify-center"
        style={{ 
          background: `linear-gradient(135deg, ${item.category === 'treat' ? '#fecaca' : item.category === 'vitamin' ? '#bbf7d0' : item.category === 'cosmetic' ? '#e9d5ff' : '#fef3c7'} 0%, white 100%)`
        }}
      >
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-24 w-24 object-contain" />
        ) : (
          <Icon className="w-16 h-16 text-slate-400" />
        )}
        
        {/* Rarity Badge */}
        <Badge 
          className={`absolute top-2 right-2 ${RARITY_COLORS[item.rarity || 'common']} text-xs`}
        >
          {item.rarity || 'common'}
        </Badge>
        
        {/* Locked Overlay */}
        {!canPurchase && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
            <Lock className="w-8 h-8 text-white mb-2" />
            <span className="text-white text-xs font-medium capitalize">
              {item.required_tier} tier required
            </span>
          </div>
        )}
      </div>
      
      {/* Item Details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-slate-800">{item.name}</h3>
          <span className="text-lg font-bold text-violet-600">${item.price?.toFixed(2)}</span>
        </div>
        
        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{item.description}</p>
        
        {/* Effect */}
        {item.effect_type && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-400">Effect:</span>
            <Badge variant="secondary" className="text-xs">
              +{item.effect_value} {item.effect_type}
            </Badge>
          </div>
        )}
        
        <Button
          onClick={() => onPurchase(item)}
          disabled={!canPurchase || isPurchasing}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300"
        >
          {isPurchasing ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : canPurchase ? (
            `Buy for $${item.price?.toFixed(2)}`
          ) : (
            `Upgrade to ${item.required_tier}`
          )}
        </Button>
      </div>
    </motion.div>
  );
}