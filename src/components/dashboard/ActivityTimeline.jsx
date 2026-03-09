import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Heart, Activity, BookOpen, MessageCircle, Gamepad2,
  Swords, Sparkles, ShoppingBag, Brain
} from 'lucide-react';

const ACTION_CONFIG = {
  feed: { icon: Heart, color: 'bg-rose-100 text-rose-600', label: 'Fed' },
  exercise: { icon: Activity, color: 'bg-blue-100 text-blue-600', label: 'Exercised' },
  study: { icon: BookOpen, color: 'bg-cyan-100 text-cyan-600', label: 'Studied' },
  interact: { icon: MessageCircle, color: 'bg-violet-100 text-violet-600', label: 'Interacted' },
  play: { icon: Gamepad2, color: 'bg-amber-100 text-amber-600', label: 'Played' },
  battle: { icon: Swords, color: 'bg-red-100 text-red-600', label: 'Battle' },
  puzzle: { icon: Sparkles, color: 'bg-purple-100 text-purple-600', label: 'Evolution' },
  gift: { icon: ShoppingBag, color: 'bg-emerald-100 text-emerald-600', label: 'Gift' },
};

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ActivityTimeline({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Brain className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.slice(0, 20).map((log, i) => {
        const config = ACTION_CONFIG[log.action_type] || ACTION_CONFIG.interact;
        const Icon = config.icon;

        return (
          <motion.div
            key={log.id || i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-start gap-3"
          >
            <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{config.label}</span>
                <span className="text-xs text-slate-400">{formatTimeAgo(log.created_date)}</span>
              </div>
              {log.companion_response && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{log.companion_response}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {log.xp_awarded > 0 && (
                  <Badge variant="outline" className="text-xs text-violet-600">+{log.xp_awarded} XP</Badge>
                )}
                {log.pcp_awarded > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-600">+{log.pcp_awarded} PcP</Badge>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}