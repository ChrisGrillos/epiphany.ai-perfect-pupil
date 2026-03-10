import React from 'react';
import { Toaster } from 'sonner';

export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50" style={{
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
      {children}
    </div>
  );
}