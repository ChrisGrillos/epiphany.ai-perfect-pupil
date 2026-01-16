import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cpu, Shield } from 'lucide-react';
import AIProviderSetup from '@/components/customization/AIProviderSetup';

export default function AISettings() {
  const navigate = useNavigate();
  const [aiConfig, setAiConfig] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    const [configs, subs] = await Promise.all([
      base44.entities.AIProviderConfig.list(),
      base44.entities.Subscription.list()
    ]);
    
    setAiConfig(configs[0]);
    setSubscription(subs[0] || { tier: 'free' });
    setLoading(false);
  };
  
  const handleSaveConfig = async (configData) => {
    // Note: In production, API keys should be encrypted server-side
    // This is a simplified implementation
    
    if (aiConfig?.id) {
      await base44.entities.AIProviderConfig.update(aiConfig.id, {
        ...configData,
        last_used: new Date().toISOString()
      });
    } else {
      await base44.entities.AIProviderConfig.create({
        ...configData,
        is_active: true,
        monthly_api_calls: 0
      });
    }
    
    // Reload config
    const configs = await base44.entities.AIProviderConfig.list();
    setAiConfig(configs[0]);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          🤖
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Settings'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-slate-800 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-violet-500" />
              AI Provider Settings
            </h1>
            <p className="text-xs text-slate-500">Configure external AI services</p>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <AIProviderSetup
          currentConfig={aiConfig}
          subscription={subscription}
          onSave={handleSaveConfig}
          monthlyUsage={aiConfig?.monthly_api_calls || 0}
        />
        
        {/* Documentation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 p-6 bg-white rounded-2xl border border-slate-200"
        >
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-500" />
            How External AI Providers Work
          </h3>
          
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <h4 className="font-medium text-slate-800 mb-1">1. Default Provider</h4>
              <p>
                The built-in provider ensures privacy and security. All data is encrypted and never leaves our secure servers.
                Perfect for users who prioritize data privacy.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-slate-800 mb-1">2. External Providers (Premium/Elite)</h4>
              <p>
                Connect your own OpenAI, Anthropic, or custom LLM API. Your companion will use these services for enhanced 
                reasoning and creativity. You'll need your own API key from the provider.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium text-slate-800 mb-1">3. Rate Limits</h4>
              <p>
                Each tier has monthly API call limits to ensure fair usage:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                <li>Free: 100 calls/month</li>
                <li>Basic: 500 calls/month</li>
                <li>Premium: 2,000 calls/month</li>
                <li>Elite: 10,000 calls/month</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-slate-800 mb-1">4. Fallback Mode</h4>
              <p>
                If your external provider fails or reaches rate limits, the system can automatically fall back to the 
                default provider to ensure your companion always responds.
              </p>
            </div>
            
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-medium text-amber-900 mb-1">⚠️ Privacy Notice</h4>
              <p className="text-amber-800">
                When using external AI providers, your conversation data will be processed by those services according to 
                their privacy policies. The default provider keeps all data encrypted and private.
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}