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
  LogOut,
  Crown,
  Check,
  Cpu,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import TierCard from '@/components/subscription/TierCard';

const TIER_PRICES = { free: 0, basic: 0.99, premium: 4.99, elite: 9.99 };

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [companion, setCompanion] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    const [currentUser, companions, subs, entitlementResponse] = await Promise.all([
      base44.auth.me(),
      base44.entities.Companion.list(),
      base44.entities.Subscription.list(),
      base44.functions.invoke('getEntitlements', {})
    ]);
    
    setUser(currentUser);
    setCompanion(companions[0]);
    const entitlementTier = entitlementResponse?.data?.tier;
    if (entitlementTier) {
      setSubscription({
        tier: entitlementTier,
        monthly_price: TIER_PRICES[entitlementTier] ?? 0
      });
    } else {
      setSubscription(subs[0] || { tier: 'free' });
    }
    setLoading(false);
  };
  
  const handleTierSelect = async (tier) => {
    if (tier === subscription?.tier) return;
    
    setProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await base44.functions.invoke('setSubscriptionTier', { tier });
    if (response.data?.error) {
      toast.error(response.data.error);
      setProcessing(false);
      return;
    }
    
    setSubscription({
      tier: response.data?.tier || tier,
      monthly_price: TIER_PRICES[response.data?.tier || tier] ?? 0
    });
    
    toast.success(`Successfully switched to ${response.data?.tier || tier}!`);
    setProcessing(false);
  };
  
  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const response = await base44.functions.invoke('deleteAccount', {});
    if (response.data?.error) {
      toast.error(response.data.error);
      setDeleting(false);
      return;
    }
    toast.success('Account data deleted. Signing out...');
    setTimeout(() => base44.auth.logout(), 1500);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Home'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">Manage your account & preferences</p>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="md:col-span-1">
            <nav className="bg-card rounded-2xl border border-border p-2 sticky top-24">
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
                      : 'text-muted-foreground hover:bg-muted'
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
                className="bg-card rounded-3xl p-6 border border-border shadow-sm"
              >
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
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
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="destructive" 
                    onClick={handleLogout}
                    className="w-full sm:w-auto"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          Delete Your Account?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <p>
                            This will <strong>permanently erase all of your data</strong>, including:
                          </p>
                          <ul className="list-disc pl-5 space-y-1 text-sm">
                            <li>All companions, stats, and evolution progress</li>
                            <li>Chat history and memories</li>
                            <li>Battle records and roster units</li>
                            <li>Subscription, inventory, and currency balance</li>
                            <li>Achievements and behavior rules</li>
                          </ul>
                          <p className="font-medium text-red-600">
                            This action cannot be undone.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          disabled={deleting}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {deleting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Yes, Delete Everything'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
                <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
                  <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
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
                <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
                  <h2 className="text-xl font-bold text-foreground mb-6">
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
                className="bg-card rounded-3xl p-6 border border-border shadow-sm"
              >
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-violet-500" />
                  Preferences
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">Push Notifications</h3>
                      <p className="text-sm text-muted-foreground">Get reminders to care for your companion</p>
                    </div>
                    <Switch
                      checked={settings.notifications}
                      onCheckedChange={(checked) => setSettings({ ...settings, notifications: checked })}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">Sound Effects</h3>
                      <p className="text-sm text-muted-foreground">Play sounds during interactions</p>
                    </div>
                    <Switch
                      checked={settings.soundEffects}
                      onCheckedChange={(checked) => setSettings({ ...settings, soundEffects: checked })}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">Dark Mode</h3>
                      <p className="text-sm text-muted-foreground">Use dark theme</p>
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
                className="bg-card rounded-3xl p-6 border border-border shadow-sm"
              >
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-violet-500" />
                  AI Provider Settings
                </h2>
                
                <p className="text-muted-foreground mb-6">
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
                className="bg-card rounded-3xl p-6 border border-border shadow-sm"
              >
                <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
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
                      <h3 className="font-medium text-foreground">Privacy Mode</h3>
                      <p className="text-sm text-muted-foreground">Hide sensitive data in screenshots</p>
                    </div>
                    <Switch
                      checked={settings.privacyMode}
                      onCheckedChange={(checked) => setSettings({ ...settings, privacyMode: checked })}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium text-foreground mb-2">Data Management</h3>
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