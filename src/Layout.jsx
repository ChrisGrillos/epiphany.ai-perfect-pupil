import React, { useRef, useEffect } from 'react';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// Tab pages that get scroll preservation
const TAB_PAGES = ['Home', 'CompanionDashboard', 'Battle', 'Settings'];

// Determines slide direction: forward (push) or back (pop)
const PAGE_DEPTH = {
  Welcome: 0,
  Home: 1,
  CompanionDashboard: 1,
  Battle: 1,
  Settings: 1,
  Store: 2,
  Achievements: 2,
  MemoryManager: 2,
  Customize: 2,
  Evolution: 2,
  AISettings: 3,
  Inventory: 3,
};

// Persisted scroll positions across renders (module-level so they survive re-mounts)
const scrollPositions = {};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const prevPageRef = useRef(currentPageName);
  const containerRef = useRef(null);

  const prevDepth = PAGE_DEPTH[prevPageRef.current] ?? 1;
  const currDepth = PAGE_DEPTH[currentPageName] ?? 1;
  const direction = currDepth >= prevDepth ? 1 : -1;

  // Save scroll position before leaving a tab page
  useEffect(() => {
    return () => {
      if (TAB_PAGES.includes(currentPageName)) {
        scrollPositions[currentPageName] = window.scrollY;
      }
    };
  }, [currentPageName]);

  // Restore scroll position when arriving at a tab page
  useEffect(() => {
    prevPageRef.current = currentPageName;
    if (TAB_PAGES.includes(currentPageName) && scrollPositions[currentPageName] != null) {
      // Small delay to let content render before restoring scroll
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositions[currentPageName]);
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [currentPageName]);

  // Only animate on mobile (check once, keep simple)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Don't animate between same-depth tab pages (tab switches feel instant)
  const isTabSwitch = TAB_PAGES.includes(currentPageName) && TAB_PAGES.includes(prevPageRef.current) && currentPageName !== prevPageRef.current;

  const variants = {
    enter: (dir) => ({
      x: isTabSwitch || !isMobile ? 0 : dir > 0 ? '30%' : '-30%',
      opacity: isTabSwitch || !isMobile ? 1 : 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir) => ({
      x: isTabSwitch || !isMobile ? 0 : dir > 0 ? '-30%' : '30%',
      opacity: isTabSwitch || !isMobile ? 1 : 0,
    }),
  };

  return (
    <div className="min-h-screen bg-background" style={{
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>
      <Toaster 
        position="top-center" 
        richColors 
        toastOptions={{
          style: {
            borderRadius: '16px',
          },
        }}
      />
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={currentPageName}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'tween', duration: isMobile && !isTabSwitch ? 0.25 : 0, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}