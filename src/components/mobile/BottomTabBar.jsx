import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home, BarChart3, Swords, Settings } from 'lucide-react';

const tabs = [
  { name: 'Home', icon: Home, page: 'Home' },
  { name: 'Dashboard', icon: BarChart3, page: 'CompanionDashboard' },
  { name: 'Battle', icon: Swords, page: 'Battle' },
  { name: 'Settings', icon: Settings, page: 'Settings' },
];

export default function BottomTabBar() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border md:hidden select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-around h-14">
        {tabs.map(({ name, icon: Icon, page }) => {
          const url = createPageUrl(page);
          const isActive = location.pathname === url || location.pathname === url + '/';
          return (
            <Link
              key={page}
              to={url}
              className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors ${
                isActive
                  ? 'text-violet-600'
                  : 'text-muted-foreground active:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium leading-none">{name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}