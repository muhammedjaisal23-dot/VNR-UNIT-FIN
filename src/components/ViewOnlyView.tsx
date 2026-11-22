import { Eye, Globe } from 'lucide-react';
import type { AuthUser } from '../types';

interface ViewOnlyViewProps {
  orgName: string;
  currentUser: AuthUser;
  publicViewEnabled?: boolean;
  onOpenPublicView?: () => void;
  onOpenAccount: () => void;
}

export function ViewOnlyView({
  orgName,
  currentUser,
  publicViewEnabled = true,
  onOpenPublicView,
  onOpenAccount,
}: ViewOnlyViewProps) {
  return (
    <main className="max-w-xl mx-auto px-4 py-14">
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-6 sm:p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-[#fff3eb] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] flex items-center justify-center mx-auto">
          <Eye className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[#1c1c1c] dark:text-[#ffffff]">
          View-only access
        </h1>
        <p className="text-sm text-[#5c5852] dark:text-[#b8b8b8] leading-relaxed">
          You are signed in as{' '}
          <span className="font-medium text-[#1c1c1c] dark:text-[#ffffff]">{currentUser.email}</span>{' '}
          with view-only access to{' '}
          <span className="font-medium text-[#1c1c1c] dark:text-[#ffffff]">{orgName}</span>. Only the
          finance admin and invited programme secretaries can record entries.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
          {publicViewEnabled && onOpenPublicView && (
            <button
              type="button"
              onClick={onOpenPublicView}
              className="min-h-[44px] px-5 inline-flex items-center gap-2 rounded-lg text-sm font-semibold cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] transition-colors"
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Open Public View</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAccount}
            className="min-h-[44px] px-5 rounded-lg text-sm font-medium cursor-pointer border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626] transition-colors"
          >
            Admin / Account Sign In
          </button>
        </div>
      </section>
    </main>
  );
}
