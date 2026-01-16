import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Cookie, 
  Dumbbell, 
  MessageCircle, 
  BookOpen, 
  Gamepad2,
  Gift,
  Sparkles,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';

const ACTIONS = [
  {
    id: 'feed',
    icon: Cookie,
    label: 'Feed',
    color: 'bg-rose-500 hover:bg-rose-600',
    description: 'Give your companion a tasty treat',
    tier: 'basic'
  },
  {
    id: 'exercise',
    icon: Dumbbell,
    label: 'Exercise',
    color: 'bg-emerald-500 hover:bg-emerald-600',
    description: 'Play active games together',
    tier: 'basic'
  },
  {
    id: 'interact',
    icon: MessageCircle,
    label: 'Chat',
    color: 'bg-violet-500 hover:bg-violet-600',
    description: 'Have a conversation',
    tier: 'basic'
  },
  {
    id: 'study',
    icon: BookOpen,
    label: 'Study',
    color: 'bg-cyan-500 hover:bg-cyan-600',
    description: 'Teach something new',
    tier: 'basic'
  },
  {
    id: 'puzzle',
    icon: Sparkles,
    label: 'Evolve',
    color: 'bg-amber-500 hover:bg-amber-600',
    description: 'Play the evolution puzzle',
    tier: 'premium'
  },
  {
    id: 'gift',
    icon: Gift,
    label: 'Gift',
    color: 'bg-pink-500 hover:bg-pink-600',
    description: 'Give an item from your inventory',
    tier: 'basic'
  }
];

export default function ActionButtons({ 
  companion, 
  subscription, 
  onAction, 
  disabled = false,
  onPuzzleClick 
}) {
  const [activeAction, setActiveAction] = useState(null);
  const [cooldowns, setCooldowns] = useState({});
  
  const userTier = subscription?.tier || 'free';
  
  const canUseAction = (actionTier) => {
    const tierOrder = ['free', 'basic', 'premium', 'elite'];
    return tierOrder.indexOf(userTier) >= tierOrder.indexOf(actionTier);
  };
  
  const handleAction = async (action) => {
    if (cooldowns[action.id] || disabled) return;
    
    if (!canUseAction(action.tier)) {
      toast.error(`Upgrade to ${action.tier} tier to unlock this action`);
      return;
    }
    
    if (action.id === 'puzzle' && onPuzzleClick) {
      onPuzzleClick();
      return;
    }
    
    setActiveAction(action.id);
    setCooldowns(prev => ({ ...prev, [action.id]: true }));
    
    await onAction(action.id);
    
    setActiveAction(null);
    
    // Cooldown timer
    setTimeout(() => {
      setCooldowns(prev => ({ ...prev, [action.id]: false }));
    }, 3000);
  };
  
  return (
    <div className="grid grid-cols-3 gap-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const isLocked = !canUseAction(action.tier);
        const isActive = activeAction === action.id;
        const hasCooldown = cooldowns[action.id];
        
        return (
          <motion.div
            key={action.id}
            whileHover={{ scale: isLocked ? 1 : 1.05 }}
            whileTap={{ scale: isLocked ? 1 : 0.95 }}
          >
            <Button
              onClick={() => handleAction(action)}
              disabled={disabled || hasCooldown}
              className={`
                relative w-full h-20 flex flex-col items-center justify-center gap-1.5
                ${isLocked ? 'bg-slate-200 hover:bg-slate-200 cursor-not-allowed' : action.color}
                text-white rounded-xl transition-all duration-200
                ${isActive ? 'ring-2 ring-white ring-offset-2' : ''}
              `}
            >
              {isLocked ? (
                <>
                  <Lock className="w-5 h-5 text-slate-400" />
                  <span className="text-xs text-slate-500">{action.tier}</span>
                </>
              ) : (
                <>
                  <AnimatePresence mode="wait">
                    {isActive ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                      />
                    ) : (
                      <motion.div
                        key="icon"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                      >
                        <Icon className="w-5 h-5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span className="text-xs font-medium">{action.label}</span>
                </>
              )}
              
              {hasCooldown && !isLocked && (
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 3, ease: 'linear' }}
                  className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 origin-left rounded-b-xl"
                />
              )}
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}