import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';

export default function ChatInterface({ 
  companion, 
  messages = [], 
  onSendMessage, 
  isTyping = false,
  disabled = false 
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    
    onSendMessage(input.trim());
    setInput('');
  };
  
  const getCompanionEmoji = () => {
    switch (companion?.mood) {
      case 'joyful': return '✨';
      case 'excited': return '🌟';
      case 'curious': return '🔮';
      case 'sad': return '💧';
      case 'tired': return '😴';
      default: return '💜';
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-5xl mb-4"
            >
              {getCompanionEmoji()}
            </motion.div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Say hello to {companion?.name || 'your companion'}!
            </h3>
            <p className="text-sm text-slate-500 max-w-xs">
              Chat with your Perfect Pupil to build trust, teach new things, and watch them grow.
            </p>
          </div>
        )}
        
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] rounded-2xl px-4 py-3
                  ${message.role === 'user' 
                    ? 'bg-violet-600 text-white rounded-br-md' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                  }
                `}
              >
                {message.role !== 'user' && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{getCompanionEmoji()}</span>
                    <span className="text-xs font-medium text-slate-500">
                      {companion?.name || 'Companion'}
                    </span>
                  </div>
                )}
                <div className={`text-sm ${message.role === 'user' ? '' : 'prose prose-sm prose-slate max-w-none'}`}>
                  {message.role === 'user' ? (
                    message.content
                  ) : (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{getCompanionEmoji()}</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        className="w-2 h-2 rounded-full bg-violet-400"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${companion?.name || 'your companion'}...`}
            disabled={disabled || isTyping}
            className="flex-1 rounded-xl border-slate-200 focus:border-violet-400 focus:ring-violet-400"
          />
          <Button
            type="submit"
            disabled={!input.trim() || disabled || isTyping}
            className="bg-violet-600 hover:bg-violet-700 rounded-xl px-4"
          >
            {isTyping ? (
              <Sparkles className="w-4 h-4 animate-pulse" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}