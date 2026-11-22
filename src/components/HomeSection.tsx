import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  HandCoins,
  Plus,
} from 'lucide-react';
import type { EntryRecord, LedgerItem, Loan, OrgMeta, Program } from '../types';
import {
  formatDisplayDate,
  formatINR,
  formatMonthLabel,
  getCurrentMonthKey,
  getLoanStatus,
} from '../utils/format';
import { AnalyticsSection } from './AnalyticsSection';
import type { AdminSection } from './Sidebar';

interface HomeSectionProps {
  org: OrgMeta;
  currentBalance: number;
  totalLoansStillToRepay: number;
  allEntries: LedgerItem[];
  income: EntryRecord[];
  expenses: EntryRecord[];
  programs: Program[];
  programsMap: Map<string, Program>;
  loans: Loan[];
  userNames: Record<string, string>;
  onNavigate: (section: AdminSection) => void;
}

export function HomeSection({
  org,
  currentBalance,
  totalLoansStillToRepay,
  allEntries,
  income,
  expenses,
  programs,
  programsMap,
  loans,
  userNames,
  onNavigate,
}: HomeSectionProps) {
  const currentMonth = getCurrentMonthKey();
  const currentMonthLabel = formatMonthLabel(currentMonth);

  const monthIncome = income
    .filter((i) => i.date.startsWith(currentMonth))
    .reduce((s, i) => s + i.amount, 0);

  const monthExpenses = expenses
    .filter((e) => e.date.startsWith(currentMonth))
    .reduce((s, e) => s + e.amount, 0);

  const recentEntries = allEntries.slice(0, 5);
  const openPrograms = programs.filter((p) => p.status === 'open');
  const activeLoans = loans.filter((l) => getLoanStatus(l) !== 'repaid');

  return (
    <div className="space-y-8">
      {/* Sculpted Wallet-Style Hero Balance Banner */}
      <section
        aria-label="Account balance overview"
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1c1c1c] via-[#261f1c] to-[#141414] dark:from-[#1c1c1c] dark:via-[#231d19] dark:to-[#141414] border border-[#303030] text-[#ffffff] p-6 sm:p-8 shadow-sm"
      >
        {/* Soft decorative ambient arcs (Bold Orange + Golden Yellow) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[#ff4f00]/22 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-[#ffc400]/16 blur-2xl"
        />

        <div className="relative z-10 space-y-6">
          {/* Top row: Org name + primary Record action */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#ffc400]">
                {org.orgName} · {currentMonthLabel}
              </p>
              <div className="mt-2">
                <span className="text-xs text-[#d4d4d4] block">Current Balance</span>
                <div
                  className={`font-num text-3xl sm:text-4xl font-bold tracking-tight mt-0.5 break-all ${
                    currentBalance < 0 ? 'text-[#ff7a3d]' : 'text-[#ffffff]'
                  }`}
                >
                  {formatINR(currentBalance)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="min-h-[44px] px-5 inline-flex items-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] transition-colors shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>New entry</span>
            </button>
          </div>

          {/* Unified inline Income / Expense flow strip */}
          <div className="grid grid-cols-2 gap-4 pt-5 border-t border-[#ffffff]/15">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-[#4ade80]/18 text-[#4ade80] inline-flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-[#b8b8b8]">Income (Month)</div>
                <div className="font-num text-base sm:text-lg font-semibold text-[#4ade80] truncate">
                  {formatINR(monthIncome)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-0 pl-4 border-l border-[#ffffff]/15">
              <span className="w-10 h-10 rounded-full bg-[#ff4f00]/22 text-[#ff7a3d] inline-flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-[#b8b8b8]">Expenses (Month)</div>
                <div className="font-num text-base sm:text-lg font-semibold text-[#ff7a3d] truncate">
                  {formatINR(monthExpenses)}
                </div>
              </div>
            </div>
          </div>

          {/* Quiet footnote for Opening Balance & Loans */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[#b8b8b8] pt-1">
            <span>
              Opening <span className="font-num text-[#ffffff]">{formatINR(org.openingBalance)}</span> + Total Income − Total Expenses
            </span>
            <span>
              Loans pending:{' '}
              <span className="font-num font-semibold text-[#ffc400]">
                {formatINR(totalLoansStillToRepay)}
              </span>{' '}
              (separate from balance)
            </span>
          </div>
        </div>
      </section>

      {/* Circular Quick-Action Dock on Mobile */}
      <section aria-label="Quick workspace navigation" className="md:hidden">
        <div className="flex items-start justify-around gap-3 py-1">
          <button
            type="button"
            onClick={() => onNavigate('ledger')}
            className="flex flex-col items-center gap-2 min-w-[84px] group cursor-pointer"
          >
            <span className="w-14 h-14 rounded-full bg-[#fff3eb] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] inline-flex items-center justify-center group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6" />
            </span>
            <div className="text-center">
              <div className="text-xs font-semibold text-[#1c1c1c] dark:text-[#ffffff]">Ledger</div>
              <div className="font-num text-[11px] text-[#5c5852] dark:text-[#b8b8b8]">
                {allEntries.length} total
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('programs')}
            className="flex flex-col items-center gap-2 min-w-[84px] group cursor-pointer"
          >
            <span className="w-14 h-14 rounded-full bg-[#fff8dc] dark:bg-[#262626] text-[#d94300] dark:text-[#ffc400] inline-flex items-center justify-center group-hover:scale-105 transition-transform">
              <CalendarRange className="w-6 h-6" />
            </span>
            <div className="text-center">
              <div className="text-xs font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
                Programmes
              </div>
              <div className="font-num text-[11px] text-[#5c5852] dark:text-[#b8b8b8]">
                {openPrograms.length} open
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('loans')}
            className="flex flex-col items-center gap-2 min-w-[84px] group cursor-pointer"
          >
            <span className="w-14 h-14 rounded-full bg-[#fff3eb] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] inline-flex items-center justify-center group-hover:scale-105 transition-transform">
              <HandCoins className="w-6 h-6" />
            </span>
            <div className="text-center">
              <div className="text-xs font-semibold text-[#1c1c1c] dark:text-[#ffffff]">Loans</div>
              <div className="font-num text-[11px] text-[#5c5852] dark:text-[#b8b8b8]">
                {activeLoans.length} active
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Open Editorial Activity & Programmes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Recent Entries Stream */}
        <section className="lg:col-span-7">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#e6e2da] dark:border-[#303030]">
            <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
              Recent Entries
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              className="min-h-[44px] px-2 inline-flex items-center gap-1 text-xs font-semibold text-[#d94300] dark:text-[#ffc400] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Open ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentEntries.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff]">
                No entries recorded yet
              </p>
              <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                Tap “New entry” above to record your first income or expense.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#efeae2] dark:divide-[#303030]">
              {recentEntries.map((item) => {
                const prog = item.programId ? programsMap.get(item.programId) : undefined;
                const isInc = item.type === 'income';
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 ${
                          isInc
                            ? 'bg-[#ecfdf3] text-[#15803d] dark:bg-[#132a1c] dark:text-[#4ade80]'
                            : 'bg-[#fff3eb] text-[#ff4f00] dark:bg-[#331c12] dark:text-[#ff7a3d]'
                        }`}
                      >
                        {isInc ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff] truncate">
                          {item.note || item.category}
                        </div>
                        <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8] flex flex-wrap items-center gap-x-1.5 mt-0.5">
                          <span className="font-num">{formatDisplayDate(item.date)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.category}</span>
                          {prog && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#d94300] dark:text-[#ffc400]">{prog.name}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{userNames[item.addedBy] || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-num text-sm font-semibold whitespace-nowrap shrink-0 ${
                        isInc
                          ? 'text-[#15803d] dark:text-[#4ade80]'
                          : 'text-[#ff4f00] dark:text-[#ff7a3d]'
                      }`}
                    >
                      {isInc ? formatINR(item.amount, true) : `-${formatINR(item.amount)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Open Programmes + Soft Capsule Loans Banner */}
        <div className="lg:col-span-5 space-y-6">
          <section>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#e6e2da] dark:border-[#303030]">
              <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
                Open Programmes ({openPrograms.length})
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('programs')}
                className="min-h-[44px] px-2 inline-flex items-center gap-1 text-xs font-semibold text-[#d94300] dark:text-[#ffc400] hover:underline whitespace-nowrap cursor-pointer"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {openPrograms.length === 0 ? (
              <div className="py-6 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                No open programmes right now. Create one in Programmes to share an expense link.
              </div>
            ) : (
              <div className="divide-y divide-[#efeae2] dark:divide-[#303030]">
                {openPrograms.slice(0, 4).map((p) => {
                  const spent = expenses
                    .filter((e) => e.programId === p.id)
                    .reduce((s, e) => s + e.amount, 0);
                  return (
                    <div
                      key={p.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-full bg-[#fff3eb] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] inline-flex items-center justify-center shrink-0">
                          <CalendarRange className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff] truncate">
                            {p.name}
                          </div>
                          <div className="font-num text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                            {formatDisplayDate(p.date)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-[#5c5852] dark:text-[#b8b8b8]">Spent</div>
                        <div className="font-num text-sm font-semibold text-[#ff4f00] dark:text-[#ff7a3d]">
                          {formatINR(spent)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Soft Capsule Loans Strip */}
          <section className="rounded-3xl bg-[#fff8dc] dark:bg-[#1c1c1c] border border-[#ffc400]/50 dark:border-[#303030] px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="w-11 h-11 rounded-full bg-[#ff4f00] dark:bg-[#ffc400] text-[#ffffff] dark:text-[#1c1c1c] inline-flex items-center justify-center shrink-0">
                <HandCoins className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8]">
                  Loans still to repay
                </div>
                <div className="font-num text-lg font-bold text-[#1c1c1c] dark:text-[#ffffff] truncate">
                  {formatINR(totalLoansStillToRepay)}
                </div>
                <div className="text-[11px] text-[#5c5852] dark:text-[#b8b8b8]">
                  {activeLoans.length > 0
                    ? `${activeLoans.length} active loan${activeLoans.length === 1 ? '' : 's'}`
                    : 'No pending loans'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('loans')}
              className="min-h-[44px] px-4 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-[#1c1c1c] text-[#ffffff] hover:bg-[#333333] dark:bg-[#262626] dark:text-[#ffc400] dark:hover:bg-[#333333] transition-colors"
            >
              Loans
            </button>
          </section>
        </div>
      </div>

      {/* Open Analytics Overview (column chart + category breakdown) */}
      <AnalyticsSection
        filteredExpenses={expenses}
        scopedIncomeForSixMonths={income}
        scopedExpensesForSixMonths={expenses}
        monthFilter="all"
      />
    </div>
  );
}
