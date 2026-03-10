import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  AlertCircle,
  CheckCircle,
  Brain,
  Heart,
  Zap
} from 'lucide-react';

const STATE_COLORS = {
  content: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  needy: 'bg-amber-100 text-amber-700 border-amber-300',
  playful: 'bg-violet-100 text-violet-700 border-violet-300',
  learning: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  tired: 'bg-slate-100 text-slate-700 border-slate-300',
  grumpy: 'bg-red-100 text-red-700 border-red-300',
  excited: 'bg-pink-100 text-pink-700 border-pink-300',
  withdrawn: 'bg-indigo-100 text-indigo-700 border-indigo-300'
};

const STATE_DESCRIPTIONS = {
  content: 'Happy and satisfied with current conditions',
  needy: 'Requires attention or care',
  playful: 'Energetic and wants to interact',
  learning: 'Focused on acquiring new knowledge',
  tired: 'Low energy, needs rest',
  grumpy: 'Neglected or unhappy, may be less cooperative',
  excited: 'Highly enthusiastic and engaged',
  withdrawn: 'Pulling back due to low trust or repeated neglect'
};

const TRANSITION_GRAPH = {
  content: ['playful', 'learning', 'needy'],
  needy: ['content', 'grumpy'],
  playful: ['excited', 'tired', 'content'],
  learning: ['content', 'tired'],
  tired: ['content', 'withdrawn'],
  grumpy: ['withdrawn', 'needy'],
  excited: ['playful', 'tired'],
  withdrawn: ['needy', 'grumpy']
};

export default function AlgorithmVisualizer({ algorithmState, companion }) {
  if (!algorithmState) return null;
  
  const currentState = algorithmState.current_state || 'content';
  const possibleTransitions = TRANSITION_GRAPH[currentState] || [];
  const flags = algorithmState.behavioral_flags || {};
  
  // Calculate helpfulness score based on stats
  const calculateHelpfulness = () => {
    if (!companion) return 50;
    const avgStats = (companion.hunger + companion.happiness + companion.fitness) / 3;
    const trustBonus = companion.trust_level * 0.3;
    return Math.min(100, avgStats + trustBonus);
  };
  
  const helpfulness = calculateHelpfulness();
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Activity className="w-6 h-6 text-violet-500" />
          Companion Algorithm State
        </h2>
        <p className="text-slate-600">
          Internal logic powering your companion's behavior and responses
        </p>
      </div>
      
      {/* Current State */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Badge className={`${STATE_COLORS[currentState]} text-lg px-4 py-2 border-2 capitalize`}>
                {currentState}
              </Badge>
              <p className="text-sm text-slate-500 mt-2">
                {STATE_DESCRIPTIONS[currentState]}
              </p>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-slate-500">Duration</p>
              <p className="text-xl font-bold text-violet-600">
                {Math.floor((algorithmState.state_duration || 0) / 60)}m
              </p>
            </div>
          </div>
          
          {/* State Machine Visualization */}
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              Possible Transitions
            </h4>
            <div className="flex flex-wrap gap-2">
              {possibleTransitions.map(state => (
                <motion.div
                  key={state}
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                >
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-sm capitalize">{state}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Helpfulness Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            Helpfulness Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">
                Based on stats + trust
              </span>
              <span className="text-2xl font-bold text-violet-600">
                {Math.round(helpfulness)}%
              </span>
            </div>
            
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${helpfulness}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full ${
                  helpfulness >= 80 ? 'bg-emerald-500' :
                  helpfulness >= 50 ? 'bg-violet-500' :
                  helpfulness >= 30 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-slate-500">Hunger</p>
                <p className="font-semibold text-rose-600">{companion?.hunger || 0}%</p>
              </div>
              <div>
                <p className="text-slate-500">Happiness</p>
                <p className="font-semibold text-amber-600">{companion?.happiness || 0}%</p>
              </div>
              <div>
                <p className="text-slate-500">Trust</p>
                <p className="font-semibold text-violet-600">{companion?.trust_level || 0}%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Behavioral Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-500" />
            Behavioral Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(flags).length > 0 ? (
              Object.entries(flags).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700 capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  {value ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                No behavioral flags set
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Response Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Response Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="font-medium text-slate-800 capitalize">
                {algorithmState.response_mode?.replace(/_/g, ' ') || 'AI Assisted'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {algorithmState.response_mode === 'algorithm_only' 
                  ? 'Using only internal logic (faster, more predictable)'
                  : algorithmState.response_mode === 'full_ai'
                  ? 'Using external AI for all responses (slower, more creative)'
                  : 'Hybrid: algorithm + AI enhancement (balanced)'
                }
              </p>
            </div>
            <Badge variant="secondary" className="capitalize">
              {algorithmState.response_mode || 'ai_assisted'}
            </Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* Recent Decisions */}
      {algorithmState.decision_log && algorithmState.decision_log.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {algorithmState.decision_log.slice(-5).reverse().map((decision, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700">{decision.description}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(decision.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}