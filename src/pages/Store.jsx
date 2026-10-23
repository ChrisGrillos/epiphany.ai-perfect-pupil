import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { pupil } from '@/api/pupilClient';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ShoppingBag, Package, Filter } from 'lucide-react';
import StoreItemCard from '@/components/store/StoreItemCard';


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
      pupil.entities.StoreItem.list(),
      pupil.entities.Subscription.list(),
      pupil.entities.Inventory.list()
    ]);
    
    setStoreItems(items);
    setSubscription(subs[0] || { tier: 'free' });
    setInventory(inv);
    setLoading(false);
  };
  
  const handlePurchase = async (item) => {
    setPurchasing(item.id);
    try {
      const { data } = await pupil.functions.invoke('addInventoryItem', { item_id: item.id });
      if (data.error) throw new Error(data.error);
      setInventory(await pupil.entities.Inventory.list()); toast.success(item.name + ' added');
    } catch (error) { toast.error(error.message); }
    finally { setPurchasing(null); }
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