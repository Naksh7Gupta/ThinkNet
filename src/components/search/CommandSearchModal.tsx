import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpDown, Search, X } from 'lucide-react';
import { searchIndex } from '../../data/searchIndex';
import { SearchItemType, SearchRecord } from '../../types/thinknet';

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const filterOptions: Array<'All' | SearchItemType> = [
  'All',
  'Episode',
  'Series',
  'Family',
  'Infrastructure',
  'Feature',
  'Agent',
  'LIIO',
  'Research Question',
];

export function CommandSearchModal({ isOpen, onClose }: CommandSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | SearchItemType>('All');
  const [sortBy, setSortBy] = useState<'relevance' | 'alphabetical'>('relevance');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = searchIndex.filter((item) => {
      if (typeFilter !== 'All' && item.type !== typeFilter) return false;
      if (!q) return true;
      const inTitle = item.title.toLowerCase().includes(q);
      const inSubtitle = item.subtitle.toLowerCase().includes(q);
      const inHierarchy = item.hierarchy.some((h) => h.toLowerCase().includes(q));
      const inKeywords = item.keywords.some((k) => k.toLowerCase().includes(q));
      return inTitle || inSubtitle || inHierarchy || inKeywords;
    });

    const scored = filtered.map((item) => {
      if (!q) return { item, score: 0 };
      let score = 0;
      const t = item.title.toLowerCase();
      if (t === q) score += 100;
      else if (t.startsWith(q)) score += 60;
      else if (t.includes(q)) score += 40;
      if (item.hierarchy.some((h) => h.toLowerCase().includes(q))) score += 20;
      if (item.subtitle.toLowerCase().includes(q)) score += 10;
      if (item.keywords.some((k) => k.toLowerCase().includes(q))) score += 5;
      return { item, score };
    });

    if (sortBy === 'alphabetical') {
      scored.sort((a, b) => a.item.title.localeCompare(b.item.title));
    } else if (q) {
      scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
    }

    return scored.slice(0, 60).map((s) => s.item);
  }, [query, typeFilter, sortBy]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, typeFilter, sortBy]);

  const handleSelect = (record: SearchRecord) => {
    onClose();
    navigate(record.route);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          results.length > 0 ? (prev - 1 + results.length) % results.length : 0
        );
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, results, activeIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-4 pt-12 sm:pt-20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Global ThinkNet Ecosystem Search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-white/[0.12] bg-[#0B0E17] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search episodes, environments, infrastructure, agents, LIIO, or research questions..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0D111A] px-4 py-2.5">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {filterOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setTypeFilter(opt)}
                className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  typeFilter === opt
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setSortBy((prev) => (prev === 'relevance' ? 'alphabetical' : 'relevance'))
            }
            className="inline-flex items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1 text-xs text-slate-300 hover:border-white/20 hover:text-white whitespace-nowrap shrink-0"
          >
            <ArrowUpDown className="h-3 w-3" />
            <span>{sortBy === 'relevance' ? 'Sort: Relevance' : 'Sort: A–Z'}</span>
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[58vh] overflow-y-auto divide-y divide-white/[0.05]">
          {results.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-300">No matching records in the ThinkNet registry.</p>
              <p className="mt-1 text-xs text-slate-500">
                Try searching for Kernel Optimization, Blender, LIIO, GRPO, or Robotics.
              </p>
            </div>
          ) : (
            results.map((record, idx) => {
              const selected = idx === activeIndex;
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => handleSelect(record)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                    selected ? 'bg-[#3B82F6]/12' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-[#38BDF8]">{record.type}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">
                        {record.hierarchy.join(' → ')}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium text-white">
                      {record.title}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {record.subtitle}
                    </p>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      selected ? 'text-[#3B82F6] translate-x-0.5' : 'text-slate-600'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#0D111A] px-4 py-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>Esc Close</span>
          </div>
          <span className="font-mono tabular-nums">
            {results.length} of {searchIndex.length} indexed records
          </span>
        </div>
      </div>
    </div>
  );
}
