import { ArrowLeft, Globe, Lock, Menu, Moon, Sun, Users } from 'lucide-react';
import type { AuthUser } from '../types';
import type { AdminSection } from './Sidebar';

interface TopBarProps {
  orgName: string;
  currentUser: AuthUser | null;
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenAccount: () => void;
  isPublicView?: boolean;
  onExitPublicView?: () => void;
  onOpenAdminSignIn?: () => void;
}

export function TopBar({
  orgName,
  currentUser,
  activeSection,
  onSelectSection,
  menuOpen,
  onToggleMenu,
  darkMode,
  onToggleTheme,
  onOpenAccount,
  isPublicView = false,
  onExitPublicView,
  onOpenAdminSignIn,
}: TopBarProps) {
  const isAuthenticated = currentUser !== null;
  const isAdmin = currentUser?.role === 'admin';
  const showAdminChrome = isAdmin && !isPublicView;

  return (
    <header className="sticky top-0 z-30 bg-[#ffffff]/95 dark:bg-[#1c1c1c]/95 backdrop-blur border-b border-[#e6e2da] dark:border-[#303030]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Side-menu trigger (Admin, mobile & desktop) + Brand wordmark */}
        <div className="flex items-center gap-2.5 min-w-0">
          {showAdminChrome && (
            <button
              type="button"
              onClick={onToggleMenu}
              aria-label={menuOpen ? 'Close side menu' : 'Open side menu'}
              aria-expanded={menuOpen}
              title="Menu"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-[#d6d1c7] dark:border-[#303030] bg-[#ffffff] dark:bg-[#262626] text-[#1c1c1c] dark:text-[#ffffff] hover:bg-[#ebe7e0] dark:hover:bg-[#333333] transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <a
            href={isPublicView ? '#public' : '#'}
            onClick={(e) => {
              if (showAdminChrome) {
                e.preventDefault();
                onSelectSection('home');
              } else if (!isPublicView) {
                e.preventDefault();
              }
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-[#ff4f00] dark:text-[#ffc400] whitespace-nowrap shrink-0 truncate max-w-[170px] sm:max-w-[260px]"
            title={orgName || 'SSF VNR Unit Finance'}
          >
            {orgName ? `${orgName} Finance` : 'SSF VNR Unit Finance'}
          </a>
        </div>

        {/* Zone 2: Clean top links (Home & Settings for Admin) or Public View indicator */}
        {showAdminChrome ? (
          <nav aria-label="Top navigation" className="hidden md:flex items-center gap-6">
            <button
              type="button"
              onClick={() => onSelectSection('home')}
              className={`min-h-[44px] px-1 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeSection === 'home'
                  ? 'border-[#ff4f00] text-[#ff4f00] dark:border-[#ffc400] dark:text-[#ffc400]'
                  : 'border-transparent text-[#5c5852] dark:text-[#b8b8b8] hover:text-[#1c1c1c] dark:hover:text-[#ffffff]'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => onSelectSection('settings')}
              className={`min-h-[44px] px-1 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeSection === 'settings'
                  ? 'border-[#ff4f00] text-[#ff4f00] dark:border-[#ffc400] dark:text-[#ffc400]'
                  : 'border-transparent text-[#5c5852] dark:text-[#b8b8b8] hover:text-[#1c1c1c] dark:hover:text-[#ffffff]'
              }`}
            >
              Settings
            </button>
          </nav>
        ) : isPublicView ? (
          <div className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-[#d94300] dark:text-[#ffc400]">
            <Globe className="w-4 h-4 shrink-0" />
            <span>Public View</span>
          </div>
        ) : (
          <div className="hidden md:block" />
        )}

        {/* Zone 3: Theme toggle + Primary Share & Access / Sign In / Exit Public View action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-[#d6d1c7] dark:border-[#303030] bg-[#f7f6f3] dark:bg-[#262626] text-[#1c1c1c] dark:text-[#ffffff] hover:bg-[#ebe7e0] dark:hover:bg-[#333333] transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4 text-[#ffc400]" /> : <Moon className="w-4 h-4 text-[#ff4f00]" />}
          </button>

          {isPublicView && isAdmin && onExitPublicView ? (
            <button
              type="button"
              onClick={onExitPublicView}
              className="min-h-[44px] px-3.5 sm:px-4 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33]"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Admin View</span>
            </button>
          ) : isPublicView && !isAuthenticated && onOpenAdminSignIn ? (
            <button
              type="button"
              onClick={onOpenAdminSignIn}
              className="min-h-[44px] px-3.5 sm:px-4 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33]"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>Sign In</span>
            </button>
          ) : isAuthenticated ? (
            <button
              type="button"
              onClick={onOpenAccount}
              className="min-h-[44px] px-3.5 sm:px-4 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33]"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>{showAdminChrome ? 'Share & Access' : 'Account'}</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
