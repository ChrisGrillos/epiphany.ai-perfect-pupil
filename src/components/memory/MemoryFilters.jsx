import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, SlidersHorizontal } from 'lucide-react';

const MEMORY_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'fact', label: 'Facts' },
  { value: 'preference', label: 'Preferences' },
  { value: 'event', label: 'Events' },
  { value: 'emotion', label: 'Emotions' },
  { value: 'skill', label: 'Skills' }
];

const SORT_OPTIONS = [
  { value: 'importance', label: 'Importance' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'recalled', label: 'Most Recalled' }
];

export default function MemoryFilters({ filter, onFilterChange }) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search memories..."
          value={filter.search}
          onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
          className="pl-10"
        />
      </div>

      {/* Type Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {MEMORY_TYPES.map(type => (
          <Button
            key={type.value}
            variant={filter.type === type.value ? 'default' : 'outline'}
            size="sm"
            className={filter.type === type.value ? 'bg-violet-600 hover:bg-violet-700' : ''}
            onClick={() => onFilterChange({ ...filter, type: type.value })}
          >
            {type.label}
          </Button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-500">Sort by:</span>
        {SORT_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            className={`text-xs ${filter.sort === opt.value ? 'text-violet-600 font-semibold' : 'text-slate-500'}`}
            onClick={() => onFilterChange({ ...filter, sort: opt.value })}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}