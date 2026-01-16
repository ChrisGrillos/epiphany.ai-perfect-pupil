import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Cpu, 
  Key, 
  Check, 
  AlertCircle, 
  Shield,
  Zap,
  Cloud,
  Server,
  Lock,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

const AI_PROVIDERS = [
  {
    id: 'default',
    name: 'Default (Built-in)',
    icon: Cpu,
    description: 'Secure, privacy-first AI provided by Perfect Pupil',
    requiresKey: false,
    tier: 'free'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: Cloud,
    description: 'GPT-4, GPT-3.5 and other OpenAI models',
    requiresKey: true,
    tier: 'premium',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: Shield,
    description: 'Claude 3 family of models',
    requiresKey: true,
    tier: 'premium',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    icon: Zap,
    description: 'Grok AI from xAI',
    requiresKey: true,
    tier: 'elite',
    models: ['grok-1', 'grok-2']
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    icon: Server,
    description: 'Connect your own LLM API',
    requiresKey: true,
    tier: 'elite'
  }
];

const TIER_CALL_LIMITS = {
  free: 100,
  basic: 500,
  premium: 2000,
  elite: 10000
};

export default function AIProviderSetup({ 
  currentConfig, 
  subscription,
  onSave,
  monthlyUsage = 0
}) {
  const [provider, setProvider] = useState(currentConfig?.provider_name || 'default');
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState(currentConfig?.api_endpoint || '');
  const [selectedModel, setSelectedModel] = useState(currentConfig?.model_name || '');
  const [fallbackEnabled, setFallbackEnabled] = useState(currentConfig?.fallback_to_default ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  
  const tier = subscription?.tier || 'free';
  const callLimit = TIER_CALL_LIMITS[tier];
  const selectedProvider = AI_PROVIDERS.find(p => p.id === provider);
  
  const canUseProvider = (providerTier) => {
    const tierOrder = ['free', 'basic', 'premium', 'elite'];
    return tierOrder.indexOf(tier) >= tierOrder.indexOf(providerTier);
  };
  
  const handleSave = async () => {
    if (!canUseProvider(selectedProvider?.tier)) {
      toast.error(`${selectedProvider.name} requires ${selectedProvider.tier} tier`);
      return;
    }
    
    if (selectedProvider?.requiresKey && !apiKey && provider !== currentConfig?.provider_name) {
      toast.error('Please enter an API key');
      return;
    }
    
    setIsSaving(true);
    
    try {
      await onSave({
        provider_name: provider,
        api_endpoint: provider === 'custom' ? apiEndpoint : null,
        model_name: selectedModel || null,
        fallback_to_default: fallbackEnabled,
        call_limit: callLimit,
        api_key: apiKey || null
      });
      
      toast.success('AI provider updated successfully!');
      setApiKey('');
    } catch (error) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  const usagePercentage = (monthlyUsage / callLimit) * 100;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Cpu className="w-6 h-6 text-violet-500" />
          AI Provider Settings
        </h2>
        <p className="text-slate-600">
          Connect external AI services or use the default privacy-first provider
        </p>
      </div>
      
      {/* Usage Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Monthly API Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">
                {monthlyUsage} / {callLimit === 10000 ? '10K' : callLimit} calls
              </span>
              <span className={`font-medium ${usagePercentage > 90 ? 'text-red-600' : usagePercentage > 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {Math.round(usagePercentage)}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePercentage}%` }}
                className={`h-full ${usagePercentage > 90 ? 'bg-red-500' : usagePercentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select AI Provider</CardTitle>
          <CardDescription>
            Choose which AI service powers your companion's intelligence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AI_PROVIDERS.map((prov) => {
              const Icon = prov.icon;
              const isSelected = provider === prov.id;
              const canUse = canUseProvider(prov.tier);
              
              return (
                <motion.button
                  key={prov.id}
                  whileHover={canUse ? { scale: 1.02 } : {}}
                  whileTap={canUse ? { scale: 0.98 } : {}}
                  onClick={() => canUse && setProvider(prov.id)}
                  disabled={!canUse}
                  className={`
                    relative p-4 rounded-xl border-2 text-left transition-all
                    ${isSelected 
                      ? 'border-violet-500 bg-violet-50' 
                      : canUse 
                        ? 'border-slate-200 hover:border-slate-300' 
                        : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      p-2 rounded-lg
                      ${isSelected ? 'bg-violet-100' : 'bg-slate-100'}
                    `}>
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-violet-600' : 'text-slate-500'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold ${isSelected ? 'text-violet-800' : 'text-slate-800'}`}>
                          {prov.name}
                        </h3>
                        {!canUse && (
                          <Lock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{prov.description}</p>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs capitalize ${!canUse ? 'bg-slate-200' : ''}`}
                      >
                        {prov.tier}
                      </Badge>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-5 h-5 text-violet-600" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Configuration */}
      {selectedProvider && selectedProvider.requiresKey && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provider Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Model Selection */}
            {selectedProvider.models && (
              <div>
                <Label>Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProvider.models.map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Custom Endpoint */}
            {provider === 'custom' && (
              <div>
                <Label>API Endpoint URL</Label>
                <Input
                  type="url"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1/chat"
                  className="mt-1"
                />
              </div>
            )}
            
            {/* API Key */}
            <div>
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="flex-1 font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  {showKey ? '👁️' : '👁️‍🗨️'}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Your API key is encrypted and never shared
              </p>
            </div>
            
            {/* Fallback */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <h4 className="font-medium text-slate-800 text-sm">Enable Fallback</h4>
                <p className="text-xs text-slate-500">
                  Use default provider if custom provider fails
                </p>
              </div>
              <Switch
                checked={fallbackEnabled}
                onCheckedChange={setFallbackEnabled}
              />
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Privacy Notice */}
      <Card className="border-emerald-300 bg-emerald-50">
        <CardContent className="flex items-start gap-3 p-4">
          <Shield className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-emerald-800 text-sm mb-1">
              Privacy & Security
            </h4>
            <p className="text-xs text-emerald-700">
              External AI providers may process your conversation data according to their own privacy policies. 
              The default provider ensures all data stays encrypted and private. API keys are stored securely with end-to-end encryption.
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || !canUseProvider(selectedProvider?.tier)}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}