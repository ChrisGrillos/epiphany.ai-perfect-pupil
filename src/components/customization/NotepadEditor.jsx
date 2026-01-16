import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  Check, 
  AlertCircle,
  Brain,
  Heart,
  Lock,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

const TIER_LIMITS = {
  free: { traits: 0, memories: 0, rules: 0 },
  basic: { traits: 3, memories: 5, rules: 2 },
  premium: { traits: 10, memories: 20, rules: 10 },
  elite: { traits: 999, memories: 999, rules: 999 }
};

const EXAMPLE_TEMPLATES = [
  {
    title: 'Witty & Playful',
    content: `Make my companion witty and playful. They should crack jokes and use puns when appropriate. Remember that I love science fiction and space exploration.`
  },
  {
    title: 'Calm & Supportive',
    content: `I want my companion to be calm, patient, and supportive. They should speak gently and offer encouragement. Remember that I'm working on mindfulness and meditation.`
  },
  {
    title: 'Curious Scholar',
    content: `My companion should be deeply curious about everything, always asking thoughtful questions. They love learning new topics, especially history and philosophy. Remember my favorite historical period is the Renaissance.`
  }
];

export default function NotepadEditor({ 
  companion, 
  subscription, 
  onParse, 
  existingMemories = [],
  existingRules = []
}) {
  const [notepadContent, setNotepadContent] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [fileInput, setFileInput] = useState(null);
  
  const tier = subscription?.tier || 'free';
  const limits = TIER_LIMITS[tier];
  const isLocked = tier === 'free';
  
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'text/plain') {
      toast.error('Please upload a .txt file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setNotepadContent(event.target.result);
      toast.success('File loaded successfully!');
    };
    reader.readAsText(file);
  };
  
  const handleParse = async () => {
    if (!notepadContent.trim()) {
      toast.error('Please enter some content first');
      return;
    }
    
    if (isLocked) {
      toast.error('Upgrade to Basic tier to use customization');
      return;
    }
    
    setIsParsing(true);
    
    try {
      const result = await onParse(notepadContent);
      setParseResult(result);
      toast.success('Successfully parsed your customizations!');
    } catch (error) {
      toast.error('Failed to parse content: ' + error.message);
    } finally {
      setIsParsing(false);
    }
  };
  
  const handleApply = async () => {
    if (!parseResult) return;
    
    // Check limits
    const totalMemories = existingMemories.length + (parseResult.memories?.length || 0);
    const totalRules = existingRules.length + (parseResult.rules?.length || 0);
    
    if (totalMemories > limits.memories) {
      toast.error(`Your ${tier} tier allows only ${limits.memories} memories. You have ${totalMemories}.`);
      return;
    }
    
    if (totalRules > limits.rules) {
      toast.error(`Your ${tier} tier allows only ${limits.rules} behavior rules. You have ${totalRules}.`);
      return;
    }
    
    toast.success('Customizations applied!');
    setParseResult(null);
    setNotepadContent('');
  };
  
  const loadTemplate = (template) => {
    setNotepadContent(template.content);
    toast.success(`Loaded template: ${template.title}`);
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <FileText className="w-6 h-6 text-violet-500" />
          Natural Language Customization
        </h2>
        <p className="text-slate-600">
          Describe how you want your companion to behave and what they should remember in plain English.
        </p>
      </div>
      
      {/* Tier Limits Display */}
      <Card className={isLocked ? 'border-amber-300 bg-amber-50' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Your Limits ({tier} tier)</span>
            {isLocked && <Lock className="w-4 h-4 text-amber-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-violet-600">{limits.traits}</p>
              <p className="text-xs text-slate-500">Personality Traits</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-600">
                {existingMemories.length}/{limits.memories === 999 ? '∞' : limits.memories}
              </p>
              <p className="text-xs text-slate-500">Memories</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {existingRules.length}/{limits.rules === 999 ? '∞' : limits.rules}
              </p>
              <p className="text-xs text-slate-500">Behavior Rules</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Templates */}
      {!isLocked && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {EXAMPLE_TEMPLATES.map((template, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => loadTemplate(template)}
                className="p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-violet-300 transition-colors"
              >
                <h4 className="font-medium text-slate-800 mb-1">{template.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{template.content}</p>
              </motion.button>
            ))}
          </div>
        </div>
      )}
      
      {/* Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Notepad Editor</span>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isLocked}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload').click()}
                disabled={isLocked}
              >
                <Upload className="w-4 h-4 mr-1" />
                Upload .txt
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notepadContent}
            onChange={(e) => setNotepadContent(e.target.value)}
            placeholder={isLocked 
              ? "Upgrade to Basic tier to use this feature..." 
              : "Example:\n\nMake my companion witty and love science. They should remember that my favorite color is blue and I enjoy hiking. When I greet them in the morning, they should be extra cheerful and ask about my plans for the day."}
            disabled={isLocked}
            className="min-h-[200px] font-mono text-sm"
          />
          
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-slate-500">
              {notepadContent.length} characters
            </span>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setNotepadContent('')}
                disabled={!notepadContent || isLocked}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
              <Button
                onClick={handleParse}
                disabled={!notepadContent.trim() || isParsing || isLocked}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {isParsing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Parse & Preview
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Parse Result Preview */}
      {parseResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-emerald-300 bg-emerald-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-emerald-800">
                <Check className="w-5 h-5" />
                Parsed Customizations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Personality Traits */}
              {parseResult.traits && parseResult.traits.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Personality Traits
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {parseResult.traits.map((trait, i) => (
                      <Badge key={i} className="bg-violet-100 text-violet-700">
                        {trait.name}: {trait.value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Memories */}
              {parseResult.memories && parseResult.memories.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Memories ({parseResult.memories.length})
                  </h4>
                  <div className="space-y-2">
                    {parseResult.memories.map((memory, i) => (
                      <div key={i} className="p-2 bg-white rounded-lg border border-slate-200">
                        <p className="text-sm">
                          <strong className="text-slate-700">{memory.key}:</strong>{' '}
                          <span className="text-slate-600">{memory.value}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Behavior Rules */}
              {parseResult.rules && parseResult.rules.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">
                    Behavior Rules ({parseResult.rules.length})
                  </h4>
                  <div className="space-y-2">
                    {parseResult.rules.map((rule, i) => (
                      <div key={i} className="p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-sm font-medium text-slate-800">{rule.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{rule.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Apply Button */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setParseResult(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApply}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Apply Customizations
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
      
      {/* Locked State */}
      {isLocked && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-4 p-6">
            <Lock className="w-12 h-12 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-1">
                Customization Locked
              </h3>
              <p className="text-sm text-amber-700">
                Upgrade to Basic ($0.99/month) to unlock natural language customization and start teaching your companion!
              </p>
            </div>
            <Button className="bg-amber-600 hover:bg-amber-700">
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}