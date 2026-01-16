import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Package, 
  Gift,
  Cookie,
  Pill,
  Palette,
  Sparkles,
  X
} from 'lucide-react';

const CATEGORY_ICONS = {
  treat: Cookie,
  vitamin: Pill,
  cosmetic: Palette,
  theme: Sparkles,
  special: Gift
};

export default function Inventory() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [companion, setCompanion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const [inv, companions, items] = await Promise.all([
      base44.entities.Inventory.list(),
      base44.entities.Companion.list(),
      base44.entities.StoreItem.list()
    ]);
    
    // Enrich inventory with item details
    const enrichedInv = inv.map(i => {
      const itemDetails = items.find(item => item.id === i.item_id || item.name === i.item_name);
      return { ...i, details: itemDetails };
    });
    
    setInventory(enrichedInv);
    setCompanion(companions[0]);
    setLoading(false);
  };
  
  const handleUseItem = async (inventoryItem) => {
    if (!companion || !inventoryItem.details) return;
    
    setUsing(inventoryItem.id);
    
    // Apply item effect
    const item = inventoryItem.details;
    let updates = {};
    
    switch (item.effect_type) {
      case 'hunger':
        updates.hunger = Math.min(100, companion.hunger + item.effect_value);
        break;
      case 'happiness':
        updates.happiness = Math.min(100, companion.happiness + item.effect_value);
        break;
      case 'fitness':
        updates.fitness = Math.min(100, companion.fitness + item.effect_value);
        break;
      case 'knowledge':
        updates.knowledge_level = Math.min(100, companion.knowledge_level + item.effect_value);
        break;
    }
    
    if (Object.keys(updates).length > 0) {
      await base44.entities.Companion.update(companion.id, updates);
      setCompanion({ ...companion, ...updates });
    }
    
    // Remove or decrease quantity
    if (inventoryItem.quantity <= 1) {
      await base44.entities.Inventory.delete(inventoryItem.id);
      setInventory(prev => prev.filter(i => i.id !== inventoryItem.id));
    } else {
      await base44.entities.Inventory.update(inventoryItem.id, {
        quantity: inventoryItem.quantity - 1
      });
      setInventory(prev => prev.map(i => 
        i.id === inventoryItem.id 
          ? { ...i, quantity: i.quantity - 1 }
          : i
      ));
    }
    
    toast.success(`Used ${item.name}! +${item.effect_value} ${item.effect_type}`);
    setUsing(null);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          📦
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Store'))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-violet-500" />
                My Inventory
              </h1>
              <p className="text-xs text-slate-500">{inventory.length} items</p>
            </div>
          </div>
          
          <Button onClick={() => navigate(createPageUrl('Store'))}>
            Visit Store
          </Button>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {inventory.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">Your inventory is empty</h2>
            <p className="text-slate-500 mb-6">Visit the store to purchase items for your companion!</p>
            <Button onClick={() => navigate(createPageUrl('Store'))} className="bg-violet-600 hover:bg-violet-700">
              Go to Store
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {inventory.map((item, index) => {
                const details = item.details || {};
                const Icon = CATEGORY_ICONS[details.category] || Gift;
                
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                  >
                    {/* Item Header */}
                    <div 
                      className="h-24 flex items-center justify-center relative"
                      style={{
                        background: `linear-gradient(135deg, ${
                          details.category === 'treat' ? '#fecaca' : 
                          details.category === 'vitamin' ? '#bbf7d0' : 
                          details.category === 'cosmetic' ? '#e9d5ff' : '#fef3c7'
                        } 0%, white 100%)`
                      }}
                    >
                      <Icon className="w-12 h-12 text-slate-400" />
                      
                      {/* Quantity Badge */}
                      {item.quantity > 1 && (
                        <div className="absolute top-2 right-2 bg-violet-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                          x{item.quantity}
                        </div>
                      )}
                    </div>
                    
                    {/* Item Details */}
                    <div className="p-4">
                      <h3 className="font-semibold text-slate-800 mb-1">
                        {item.item_name || 'Unknown Item'}
                      </h3>
                      
                      {details.description && (
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                          {details.description}
                        </p>
                      )}
                      
                      {details.effect_type && (
                        <p className="text-xs text-violet-600 font-medium mb-3">
                          +{details.effect_value} {details.effect_type}
                        </p>
                      )}
                      
                      <Button
                        onClick={() => handleUseItem(item)}
                        disabled={using === item.id || !['treat', 'vitamin'].includes(details.category)}
                        className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300"
                      >
                        {using === item.id ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Using...
                          </span>
                        ) : ['treat', 'vitamin'].includes(details.category) ? (
                          `Use on ${companion?.name || 'Companion'}`
                        ) : (
                          'Equipped'
                        )}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}