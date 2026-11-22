import { useEffect } from 'react';
import { BookOpen, CalendarRange, HandCoins, Home, Settings, X } from 'lucide-react';
import { formatINR } from '../utils/format';

export type AdminSection = 'home' | 'ledger' | 'programs' | 'loans' | 'settings';

interface SidebarProps {
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  open: boolean;
  onClose: () => void;
  entriesCount: number;
  openProgramsCount: number;
  pendingLoansAmount: number;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  open,
  onClose,
  entriesCount,
  openProgramsCount,
  pendingLoansAmount,
}: SidebarProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleSelect = (section: AdminSection) => {
    onSelectSection(section);
    onClose();
  };

  // The 3 primary side buttons for Finance Admin navigation
  const sideButtons: Array<{
    id: Extract<AdminSection, 'ledger' | 'programs' | 'loans'>;
    label: string;
    meta: string;
    icon: typeof BookOpen;
  }> = [
    {
      id: 'ledger',
      label: 'Ledger',
      meta: `${entriesCount} ${entriesCount === 1 ? 'entry' : 'entries'}`,
      icon: BookOpen,
    },
    {
      id: 'programs',
      label: 'Programmes',
      meta: `${openProgramsCount} open`,
      icon: CalendarRange,
    },
    {
      id: 'loans',
      label: 'Loans',
      meta: pendingLoansAmount > 0 ? `${formatINR(pendingLoansAmount)} due` : 'All clear',
      icon: HandCoins,
    },
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <div
        className="fixed inset-0 bg-[#121212]/70 backdrop-blur-xs"
        onClick={onClose}
      />
      <aside className="relative z-10 w-72 sm:w-80 max-w-[85vw] h-full bg-[#ffffff] dark:bg-[#1c1c1c] border-r border-[#e6e2da] dark:border-[#303030] shadow-2xl p-4 sm:p-5 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e6e2da] dark:border-[#303030]">
            <span className="text-sm font-bold text-[#ff4f00] dark:text-[#ffc400]">
              Navigation
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-[#fff3eb] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] hover:bg-[#ffe4d1] dark:hover:bg-[#333333] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3 primary side buttons */}
          <nav aria-label="Workspace sections" className="space-y-2">
            {sideButtons.map((btn) => {
              const Icon = btn.icon;
              const isActive = activeSection === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleSelect(btn.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full min-h-[56px] px-3 py-2.5 rounded-full text-left flex items-center gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#ff4f00] text-[#ffffff] dark:bg-[#ffc400] dark:text-[#1c1c1c]'
                      : 'text-[#1c1c1c] hover:bg-[#ebe7e0] dark:text-[#ffffff] dark:hover:bg-[#262626]'
                  }`}
                >
                  <span
                    className={`w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? 'bg-[#ffffff]/20 text-[#ffffff] dark:bg-[#1c1c1c]/15 dark:text-[#1c1c1c]'
                        : 'bg-[#fff3eb] text-[#ff4f00] dark:bg-[#262626] dark:text-[#ffc400]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-sm font-semibold leading-tight whitespace-nowrap truncate">
                      {btn.label}
                    </div>
                    <div
                      className={`font-num text-xs mt-0.5 truncate ${
                        isActive
                          ? 'text-[#ffffff]/85 dark:text-[#1c1c1c]/80'
                          : 'text-[#5c5852] dark:text-[#b8b8b8]'
                      }`}
                    >
                      {btn.meta}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Home & Settings quick links */}
          <div className="pt-4 border-t border-[#e6e2da] dark:border-[#303030] space-y-1.5">
            <button
              type="button"
              onClick={() => handleSelect('home')}
              className={`w-full min-h-[44px] px-4 rounded-full text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
                activeSection === 'home'
                  ? 'bg-[#fff3eb] text-[#d94300] dark:bg-[#262626] dark:text-[#ffc400]'
                  : 'text-[#5c5852] dark:text-[#b8b8b8] hover:bg-[#f1eee9] dark:hover:bg-[#262626]'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Home</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('settings')}
              className={`w-full min-h-[44px] px-4 rounded-full text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
                activeSection === 'settings'
                  ? 'bg-[#fff3eb] text-[#d94300] dark:bg-[#262626] dark:text-[#ffc400]'
                  : 'text-[#5c5852] dark:text-[#b8b8b8] hover:bg-[#f1eee9] dark:hover:bg-[#262626]'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
