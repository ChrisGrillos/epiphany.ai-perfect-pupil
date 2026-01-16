import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  User, 
  CreditCard, 
  Bell, 
  Shield, 
  Palette,
  LogOut,
  Crown,
  Check,
  Cpu
} from 'lucide-react';
import TierCard from '@/components/subscription/TierCard';

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [companion, setCompanion] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeSection, setActiveSection] = useState('account');
  
  // Settings state
  const [settings, setSettings] = useState({
    notifications: true,
    soundEffects: true,
    darkMode: false,
    privacyMode: false
  });
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const [currentUser, companions, subs] = await Promise.all([
      base44.auth.me(),
      base44.entities.Companion.list(),
      base44.entities.Subscription.list()
    ]);
    
    setUser(currentUser);
    setCompanion(companions[0]);
    setSubscription(subs[0] || { tier: 'free' });
    setLoading(false);
  };
  
  const handleTierSelect = async (tier) => {
    if (tier === subscription?.tier) return;
    
    setProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const tierPrices = {
      free: 0,
      basic: 0.99,
      premium: 4.99,
      elite: 9.99
    };
    
    const tierFeatures = {
      free: ['basic_view', 'limited_chat'],
      basic: ['full_care', 'unlimited_chat', 'store_access', 'achievements'],
      premium: ['full_care', 'unlimited_chat', 'store_access', 'achievements', 'evolution_control', 'customization'],
      elite: ['full_care', 'unlimited_chat', 'store_access', 'achievements', 'evolution_control', 'customization', 'puzzles', 'advanced_personalization']
    };
    
    if (subscription?.id) {
      await base44.entities.Subscription.update(subscription.id, {
        tier,
        monthly_price: tierPrices[tier],
        features: tierFeatures[tier]
      });
    } else {
      await base44.entities.Subscription.create({
        tier,
        monthly_price: tierPrices[tier],
        is_active: true,
        features: tierFeatures[tier]
      });
    }
    
    setSubscription(prev => ({
      ...prev,
      tier,
      monthly_price: tierPrices[tier],
      features: tierFeatures[tier]
    }));
    
    toast.success(`Successfully upgraded to ${tier}!`);
    setProcessing(false);
  };
  
  const handleLogout = async () => {
    await base44.auth.logout();
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          ⚙️
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Home'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-slate-800">Settings</h1>
            <p className="text-xs text-slate-500">Manage your account & preferences</p>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="md:col-span-1">
            <nav className="bg-white rounded-2xl border border-slate-200 p-2 sticky top-24">
              {[
                { id: 'account', icon: User, label: 'Account' },
                { id: 'subscription', icon: CreditCard, label: 'Subscription' },
                { id: 'ai', icon: Cpu, label: 'AI Provider' },
                { id: 'preferences', icon: Bell, label: 'Preferences' },
                { id: 'privacy', icon: Shield, label: 'Privacy' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors
                    ${activeSection === item.id 
                      ? 'bg-violet-100 text-violet-700' 
                      : 'text-slate-600 hover:bg-slate-50'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
          
          {/* Content Area */}
          <div className="md:col-span-3">
            {/* Account Section */}
            {activeSection === 'account' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
              >
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-violet-500" />
                  Account Information
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input value={user?.email || ''} disabled className="mt-1" />
                  </div>
                  
                  <div>
                    <Label>Name</Label>
                    <Input value={user?.full_name || ''} disabled className="mt-1" />
                  </div>
                  
                  <div>
                    <Label>Companion Name</Label>
                    <Input value={companion?.name || ''} disabled className="mt-1" />
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                <Button 
                  variant="destructive" 
                  onClick={handleLogout}
                  className="w-full md:w-auto"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </motion.div>
            )}
            
            {/* Subscription Section */}
            {activeSection === 'subscription' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Current Plan */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    Current Plan
                  </h2>
                  
                  <div className="flex items-center justify-between p-4 bg-violet-50 rounded-xl">
                    <div>
                      <h3 className="font-bold text-lg text-violet-700 capitalize">
                        {subscription?.tier || 'Free'}
                      </h3>
                      <p className="text-sm text-violet-600">
                        {subscription?.monthly_price === 0 
                          ? 'No monthly charge' 
                          : `$${subscription?.monthly_price}/month`
                        }
                      </p>
                    </div>
                    <Check className="w-6 h-6 text-violet-600" />
                  </div>
                </div>
                
                {/* All Plans */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 mb-6">
                    Available Plans
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['free', 'basic', 'premium', 'elite'].map(tier => (
                      <TierCard
                        key={tier}
                        tier={tier}
                        isCurrentTier={subscription?.tier === tier}
                        onSelect={handleTierSelect}
                        isProcessing={processing}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Preferences Section */}
            {activeSection === 'preferences' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
              >
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-violet-500" />
                  Preferences
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-800">Push Notifications</h3>
                      <p className="text-sm text-slate-500">Get reminders to care for your companion</p>
                    </div>
                    <Switch
                      checked={settings.notifications}
                      onCheckedChange={(checked) => setSettings({ ...settings, notifications: checked })}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-800">Sound Effects</h3>
                      <p className="text-sm text-slate-500">Play sounds during interactions</p>
                    </div>
                    <Switch
                      checked={settings.soundEffects}
                      onCheckedChange={(checked) => setSettings({ ...settings, soundEffects: checked })}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-800">Dark Mode</h3>
                      <p className="text-sm text-slate-500">Use dark theme</p>
                    </div>
                    <Switch
                      checked={settings.darkMode}
                      onCheckedChange={(checked) => setSettings({ ...settings, darkMode: checked })}
                    />
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* AI Provider Section */}
            {activeSection === 'ai' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
              >
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-violet-500" />
                  AI Provider Settings
                </h2>
                
                <p className="text-slate-600 mb-6">
                  Configure external AI services for enhanced companion intelligence. Premium and Elite tiers can connect 
                  custom AI providers like OpenAI, Anthropic, or your own LLM endpoints.
                </p>
                
                <Button
                  onClick={() => navigate(createPageUrl('AISettings'))}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <Cpu className="w-4 h-4 mr-2" />
                  Manage AI Providers
                </Button>
              </motion.div>
            )}
            
            {/* Privacy Section */}
            {activeSection === 'privacy' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm"
              >
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-violet-500" />
                  Privacy & Security
                </h2>
                
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-emerald-800">Your Data is Protected</h3>
                        <p className="text-sm text-emerald-700 mt-1">
                          Perfect Pupil uses end-to-end encryption. Your companion data and conversations 
                          are never sold or shared with third parties.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-800">Privacy Mode</h3>
                      <p className="text-sm text-slate-500">Hide sensitive data in screenshots</p>
                    </div>
                    <Switch
                      checked={settings.privacyMode}
                      onCheckedChange={(checked) => setSettings({ ...settings, privacyMode: checked })}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium text-slate-800 mb-2">Data Management</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        Export My Data
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        Delete All Data
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}