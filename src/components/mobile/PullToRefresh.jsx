import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 80;

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const refreshInProgress = useRef(false);
  const startY = useRef(0);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (refreshInProgress.current || window.scrollY > 0 || e.touches.length !== 1) return;
    let target = e.target;
    if (target instanceof Element && target.closest('button, input, textarea, select, a, [role="tab"]')) return;
    while (target instanceof Element && target !== containerRef.current) {
      if (target.scrollTop > 0) return;
      target = target.parentElement;
    }
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    const dampened = Math.min(diff * 0.5, 120);
    setPullDistance(dampened);
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);
    if (pullDistance >= THRESHOLD && !refreshing) {
      refreshInProgress.current = true;
      setRefreshing(true);
      setError('');
      setPullDistance(THRESHOLD);
      try { await onRefresh?.(); }
      catch (error) { setError(error.message || 'Refresh failed. Try again.'); }
      finally { refreshInProgress.current = false; setRefreshing(false); }
    }
    setPullDistance(0);
  }, [pulling, pullDistance, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { setPulling(false); setPullDistance(0); }}
      data-pull-refresh
      className="relative overflow-auto"
      style={{ minHeight: '100%' }}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pulling || refreshing ? pullDistance : 0 }}
      >
        <motion.div
          animate={{ rotate: refreshing ? 360 : progress * 270 }}
          transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
          className="text-violet-500"
        >
          <RefreshCw className="w-5 h-5" style={{ opacity: Math.max(0.3, progress) }} />
        </motion.div>
      </div>
      {error && <p role="alert" className="px-4 py-2 text-sm text-red-700">{error}</p>}
      {children}
    </div>
  );
}
