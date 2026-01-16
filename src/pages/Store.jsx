import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ShoppingBag, Package, Filter } from 'lucide-react';
import StoreItemCard from '@/components/store/StoreItemCard';

const DEFAULT_STORE_ITEMS = [
  // Treats
  { name: 'Berry Delight', description: 'A sweet berry treat that boosts happiness', category: 'treat', price: 0.49, effect_type: 'happiness', effect_value: 15, rarity: 'common', required_tier: 'basic' },
  { name: 'Cosmic Cookie', description: 'A magical cookie from the stars', category: 'treat', price: 0.99, effect_type: 'hunger', effect_value: 25, rarity: 'uncommon', required_tier: 'basic' },
  { name: 'Golden Nectar', description: 'Legendary treat with amazing effects', category: 'treat', price: 2.99, effect_type: 'happiness', effect_value: 40, rarity: 'legendary', required_tier: 'premium' },
  
  // Vitamins
  { name: 'Brain Boost', description: 'Enhances learning capacity', category: 'vitamin', price: 1.49, effect_type: 'knowledge', effect_value: 10, rarity: 'common', required_tier: 'basic' },
  { name: 'Energy Elixir', description: 'Increases fitness and stamina', category: 'vitamin', price: 1.49, effect_type: 'fitness', effect_value: 15, rarity: 'uncommon', required_tier: 'basic' },
  { name: 'Memory Enhancer', description: 'Deep reasoning boost', category: 'vitamin', price: 4.99, effect_type: 'knowledge', effect_value: 30, rarity: 'rare', required_tier: 'premium' },
  
  // Cosmetics
  { name: 'Sparkle Aura', description: 'Adds a shimmering effect', category: 'cosmetic', price: 1.99, effect_type: 'appearance', effect_value: 1, rarity: 'common', required_tier: 'basic' },
  { name: 'Rainbow Trail', description: 'Colorful trail follows your companion', category: 'cosmetic', price: 3.99, effect_type: 'appearance', effect_value: 1, rarity: 'rare', required_tier: 'premium' },
  { name: 'Celestial Crown', description: 'A crown fit for royalty', category: 'cosmetic', price: 6.99, effect_type: 'appearance', effect_value: 1, rarity: 'legendary', required_tier: 'elite' },
  
  // Themes
  { name: 'Forest Sanctuary', description: 'A peaceful forest environment', category: 'theme', price: 2.99, effect_type: 'appearance', effect_value: 1, rarity: 'uncommon', required_tier: 'basic' },
  { name: 'Crystal Cavern', description: 'A mystical crystal cave', category: 'theme', price: 4.99, effect_type: 'appearance', effect_value: 1, rarity: 'rare', required_tier: 'premium' },
  { name: 'Cosmic Nebula', description: 'Float among the stars', category: 'theme', price: 9.99, effect_type: 'appearance', effect_value: 1, rarity: 'legendary', required_tier: 'elite' }
];

export default function Store() {
  const navigate = useNavigate();
  const [storeItems, setStoreItems] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [purchasing, setPurchasing] = useState(null);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const [items, subs, inv] = await Promise.all([
      base44.entities.StoreItem.list(),
      base44.entities.Subscription.list(),
      base44.entities.Inventory.list()
    ]);
    
    // If no items exist, create defaults
    if (items.length === 0) {
      await base44.entities.StoreItem.bulkCreate(DEFAULT_STORE_ITEMS);
      setStoreItems(DEFAULT_STORE_ITEMS);
    } else {
      setStoreItems(items);
    }
    
    setSubscription(subs[0] || { tier: 'free' });
    setInventory(inv);
    setLoading(false);
  };
  
  const handlePurchase = async (item) => {
    if (subscription?.tier === 'free') {
      toast.error('Upgrade to Basic tier to purchase items');
      navigate(createPageUrl('Settings'));
      return;
    }
    
    setPurchasing(item.id);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Add to inventory
    await base44.entities.Inventory.create({
      item_id: item.id,
      item_name: item.name,
      quantity: 1,
      purchased_at: new Date().toISOString()
    });
    
    toast.success(`${item.name} added to your inventory!`);
    setPurchasing(null);
    
    // Refresh inventory
    const newInv = await base44.entities.Inventory.list();
    setInventory(newInv);
  };
  
  const filteredItems = activeCategory === 'all' 
    ? storeItems 
    : storeItems.filter(item => item.category === activeCategory);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          🛍️
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
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Home'))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-slate-800">Item Store</h1>
              <p className="text-xs text-slate-500">Treats, vitamins & more</p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => navigate(createPageUrl('Inventory'))}
            className="gap-2"
          >
            <Package className="w-4 h-4" />
            Inventory ({inventory.length})
          </Button>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Category Filter */}
        <div className="mb-6">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="bg-white border border-slate-200 rounded-xl p-1">
              <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
              <TabsTrigger value="treat" className="rounded-lg">Treats</TabsTrigger>
              <TabsTrigger value="vitamin" className="rounded-lg">Vitamins</TabsTrigger>
              <TabsTrigger value="cosmetic" className="rounded-lg">Cosmetics</TabsTrigger>
              <TabsTrigger value="theme" className="rounded-lg">Themes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Tier Notice */}
        {subscription?.tier === 'free' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-amber-800">
                <strong>Upgrade to Basic ($0.99/month)</strong> to purchase items and unlock the store!
              </p>
            </div>
            <Button 
              size="sm" 
              className="bg-amber-500 hover:bg-amber-600"
              onClick={() => navigate(createPageUrl('Settings'))}
            >
              Upgrade
            </Button>
          </motion.div>
        )}
        
        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <StoreItemCard
                item={item}
                onPurchase={handlePurchase}
                userTier={subscription?.tier || 'free'}
                isPurchasing={purchasing === item.id}
              />
            </motion.div>
          ))}
        </div>
        
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No items in this category yet</p>
          </div>
        )}
      </main>
    </div>
  );
}