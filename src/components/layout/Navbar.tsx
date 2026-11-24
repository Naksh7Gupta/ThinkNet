import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';

interface NavbarProps {
  onOpenSearch: () => void;
}

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Research', to: '/research' },
  { label: 'Environments', to: '/environments' },
  { label: 'Episodes', to: '/episodes' },
  { label: 'Infrastructure', to: '/infrastructure' },
  { label: 'Data Generator', to: '/data-generator' },
  { label: 'Agentic AI', to: '/agentic-ai' },
  { label: 'LIIO', to: '/liio' },
  { label: 'About', to: '/about' },
];

export function Navbar({ onOpenSearch }: NavbarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#07090E]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="font-display text-base font-bold tracking-[0.14em] text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3B82F6]"
        >
          THINKNET
        </Link>

        {/* Zone 2: Single-Line Navigation Links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-4 xl:gap-6 text-[13px] font-medium"
        >
          {navLinks.map((link) => {
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3B82F6] ${
                  active
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {link.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-[#3B82F6]"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action (Global Search) + Mobile Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-2.5 rounded-md border border-white/[0.12] bg-[#0D111A] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors duration-150 hover:border-[#3B82F6]/60 hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B82F6]"
            aria-label="Open global search"
          >
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span>Search</span>
            <kbd className="hidden sm:inline-block font-mono text-[11px] text-slate-400">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-md border border-white/[0.1] bg-[#0D111A] text-slate-300 hover:text-white"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden border-t border-white/[0.08] bg-[#0B0E17] px-4 py-4"
        >
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#3B82F6]/15 text-white border border-[#3B82F6]/40'
                      : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
