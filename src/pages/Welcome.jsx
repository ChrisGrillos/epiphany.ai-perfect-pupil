import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, Sparkles, Heart, Shield, Brain } from 'lucide-react';
import { toast } from 'sonner';
import StageSelector from '@/components/onboarding/StageSelector';
import SpeciesSelector from '@/components/onboarding/SpeciesSelector';
import TierCard from '@/components/subscription/TierCard';

const STEPS = ['welcome', 'stage', 'species', 'name', 'tier', 'creating'];

export default function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    stage: 'child',
    species: 'celestial',
    tier: 'free'
  });
  const [isCreating, setIsCreating] = useState(false);
  
  useEffect(() => {
    checkExistingCompanion();
  }, []);
  
  const checkExistingCompanion = async () => {
    const companions = await base44.entities.Companion.list();
    if (companions.length > 0) {
      navigate(createPageUrl('Home'));
    }
  };
  
  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };
  
  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };
  
  const handleCreate = async () => {
    setIsCreating(true);
    setStep(STEPS.indexOf('creating'));
    try {
      const tierResponse = await base44.functions.invoke('setSubscriptionTier', {
        tier: formData.tier
      });
      if (tierResponse.data?.error) {
        throw new Error(tierResponse.data.error);
      }

      const createResponse = await base44.functions.invoke('createCompanion', {
        name: formData.name,
        stage: formData.stage,
        species: formData.species
      });
      if (createResponse.data?.error) {
        throw new Error(createResponse.data.error);
      }

      setTimeout(() => {
        navigate(createPageUrl('Home'));
      }, 1200);
    } catch (error) {
      toast.error(error?.message || 'Unable to create companion right now.');
      setStep(STEPS.indexOf('tier'));
      setIsCreating(false);
    }
  };
  
  const currentStep = STEPS[step];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-100 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-600"
          initial={{ width: 0 }}
          animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <AnimatePresence mode="wait">
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl mb-8"
              >
                ✨
              </motion.div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
                Welcome to <span className="text-violet-600">Epiphany.AI</span>
              </h1>
              <h2 className="text-2xl font-semibold text-slate-600 mb-6">
                Perfect Pupil™
              </h2>
              
              <p className="text-lg text-slate-500 max-w-xl mx-auto mb-12">
                Your emotionally safe AI companion that grows with you, teaches empathy, and respects your privacy.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {[
                  { icon: Heart, title: 'Empathy First', desc: 'Learn and grow together through meaningful interactions' },
                  { icon: Shield, title: 'Privacy Safe', desc: 'Your data belongs to you, always encrypted and secure' },
                  { icon: Brain, title: 'Honest AI', desc: '100% truthful feedback with emotional intelligence' }
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm"
                  >
                    <feature.icon className="w-10 h-10 text-violet-500 mx-auto mb-4" />
                    <h3 className="font-semibold text-slate-800 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-500">{feature.desc}</p>
                  </motion.div>
                ))}
              </div>
              
              <Button
                onClick={handleNext}
                size="lg"
                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-6 text-lg rounded-xl"
              >
                Begin Your Journey
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          )}
          
          {/* Stage Selection */}
          {currentStep === 'stage' && (
            <motion.div
              key="stage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <StageSelector
                selectedStage={formData.stage}
                onSelect={(stage) => setFormData({ ...formData, stage })}
              />
              
              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext} className="bg-violet-600 hover:bg-violet-700">
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
          
          {/* Species Selection */}
          {currentStep === 'species' && (
            <motion.div
              key="species"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SpeciesSelector
                selectedSpecies={formData.species}
                onSelect={(species) => setFormData({ ...formData, species })}
              />
              
              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleNext} className="bg-violet-600 hover:bg-violet-700">
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
          
          {/* Name Input */}
          {currentStep === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-6xl mb-6"
              >
                💜
              </motion.div>
              
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Name Your Companion
              </h2>
              <p className="text-slate-500 mb-8">
                Choose a special name for your Perfect Pupil
              </p>
              
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter a name..."
                className="text-center text-lg py-6 rounded-xl border-2 border-slate-200 focus:border-violet-500"
              />
              
              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleNext} 
                  disabled={!formData.name.trim()}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
          
          {/* Tier Selection */}
          {currentStep === 'tier' && (
            <motion.div
              key="tier"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  Choose Your Plan
                </h2>
                <p className="text-slate-500">
                  Start free or unlock premium features
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['free', 'basic', 'premium', 'elite'].map((tier) => (
                  <TierCard
                    key={tier}
                    tier={tier}
                    isCurrentTier={formData.tier === tier}
                    onSelect={(t) => setFormData({ ...formData, tier: t })}
                  />
                ))}
              </div>
              
              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleCreate} className="bg-violet-600 hover:bg-violet-700">
                  Create My Companion
                  <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
          
          {/* Creating Animation */}
          {currentStep === 'creating' && (
            <motion.div
              key="creating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 360]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-8xl mb-8"
              >
                ✨
              </motion.div>
              
              <h2 className="text-2xl font-bold text-slate-800 mb-4">
                Creating {formData.name}...
              </h2>
              <p className="text-slate-500">
                Your Perfect Pupil is being born into the world
              </p>
              
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2 }}
                className="h-2 bg-violet-500 rounded-full mt-8 max-w-md mx-auto"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
