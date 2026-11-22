import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarRange,
  Globe,
  Lock,
  Search,
  Wallet,
} from 'lucide-react';
import type { LedgerItem, Program, PublicStatePayload } from '../types';
import {
  formatDisplayDate,
  formatINR,
  formatMonthLabel,
  getCurrentMonthKey,
  isLateEntry,
} from '../utils/format';
import { AnalyticsSection } from './AnalyticsSection';

interface PublicViewProps {
  publicState: PublicStatePayload;
  isAdmin: boolean;
  onExitPublicView?: () => void;
  onEnablePublicView?: () => Promise<void>;
}

export function PublicView({
  publicState,
  isAdmin,
  onExitPublicView,
  onEnablePublicView,
}: PublicViewProps) {
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [enabling, setEnabling] = useState(false);

  const org = publicState.org;
  const programs = publicState.programs || [];
  const income = publicState.income || [];
  const expenses = publicState.expenses || [];
  const userNames = publicState.userNames || {};

  const programsMap = useMemo(() => {
    const map = new Map<string, Program>();
    for (const p of programs) map.set(p.id, p);
    return map;
  }, [programs]);

  const allLedgerEntries: LedgerItem[] = useMemo(() => {
    const combined: LedgerItem[] = [
      ...income.map((i) => ({ ...i, type: 'income' as const })),
      ...expenses.map((e) => ({ ...e, type: 'expense' as const })),
    ];
    combined.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.timestamp - a.timestamp;
    });
    return combined;
  }, [income, expenses]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([getCurrentMonthKey()]);
    for (const entry of allLedgerEntries) {
      if (entry.date && entry.date.length >= 7) {
        set.add(entry.date.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allLedgerEntries]);

  const monthAndProgramEntries = useMemo(() => {
    return allLedgerEntries.filter((entry) => {
      if (monthFilter !== 'all' && !entry.date.startsWith(monthFilter)) return false;
      if (programFilter === 'none' && entry.programId) return false;
      if (
        programFilter !== 'all' &&
        programFilter !== 'none' &&
        entry.programId !== programFilter
      ) {
        return false;
      }
      return true;
    });
  }, [allLedgerEntries, monthFilter, programFilter]);

  const visibleEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthAndProgramEntries.filter((entry) => {
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      if (!q) return true;
      const progName = entry.programId ? programsMap.get(entry.programId)?.name || '' : 'general';
      const haystack = [
        entry.note,
        entry.category,
        String(entry.amount),
        formatINR(entry.amount),
        progName,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [monthAndProgramEntries, typeFilter, searchQuery, programsMap]);

  const allTimeIncome = useMemo(() => income.reduce((s, i) => s + i.amount, 0), [income]);
  const allTimeExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const currentBalance = (org?.openingBalance || 0) + allTimeIncome - allTimeExpenses;

  const filteredIncomeTotal = useMemo(
    () =>
      monthAndProgramEntries
        .filter((e) => e.type === 'income')
        .reduce((s, e) => s + e.amount, 0),
    [monthAndProgramEntries]
  );

  const filteredExpensesTotal = useMemo(
    () =>
      monthAndProgramEntries
        .filter((e) => e.type === 'expense')
        .reduce((s, e) => s + e.amount, 0),
    [monthAndProgramEntries]
  );

  const filteredExpensesList = useMemo(
    () => monthAndProgramEntries.filter((e) => e.type === 'expense'),
    [monthAndProgramEntries]
  );

  const scopedIncomeForSixMonths = useMemo(() => {
    return income.filter((i) => {
      if (programFilter === 'none') return !i.programId;
      if (programFilter !== 'all') return i.programId === programFilter;
      return true;
    });
  }, [income, programFilter]);

  const scopedExpensesForSixMonths = useMemo(() => {
    return expenses.filter((e) => {
      if (programFilter === 'none') return !e.programId;
      if (programFilter !== 'all') return e.programId === programFilter;
      return true;
    });
  }, [expenses, programFilter]);

  const activeScopeLabel = useMemo(() => {
    const mLabel = formatMonthLabel(monthFilter);
    const pLabel =
      programFilter === 'all'
        ? 'All programmes'
        : programFilter === 'none'
          ? 'General'
          : programsMap.get(programFilter)?.name || 'Selected programme';
    return `${mLabel} · ${pLabel}`;
  }, [monthFilter, programFilter, programsMap]);

  if (!publicState.enabled || !org) {
    return (
      <main className="max-w-xl mx-auto px-4 py-14">
        <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#fff3eb] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#1c1c1c] dark:text-[#ffffff]">
            Public view is turned off
          </h1>
          <p className="text-sm text-[#5c5852] dark:text-[#b8b8b8] leading-relaxed">
            The finance admin of{' '}
            <span className="font-medium text-[#1c1c1c] dark:text-[#ffffff]">
              {publicState.orgName || 'SSF VNR Unit'}
            </span>{' '}
            has currently disabled public access to the financial summary.
          </p>
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {onEnablePublicView && (
                <button
                  type="button"
                  disabled={enabling}
                  onClick={async () => {
                    setEnabling(true);
                    try {
                      await onEnablePublicView();
                    } finally {
                      setEnabling(false);
                    }
                  }}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-semibold cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50"
                >
                  {enabling ? 'Enabling...' : 'Turn on Public View'}
                </button>
              )}
              {onExitPublicView && (
                <button
                  type="button"
                  onClick={onExitPublicView}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-medium cursor-pointer border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626]"
                >
                  Back to Admin
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Subtle admin preview bar */}
      {isAdmin && onExitPublicView && (
        <div className="rounded-xl bg-[#fff3eb] dark:bg-[#1c1c1c] border border-[#ffc9ad] dark:border-[#ff4f00]/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#1c1c1c] dark:text-[#ffffff]">
            <Globe className="w-4 h-4 text-[#ff4f00] dark:text-[#ffc400] shrink-0" />
            <span>
              Previewing <strong>Public View</strong> — loans, committee members, and editing controls are hidden.
            </span>
          </div>
          <button
            type="button"
            onClick={onExitPublicView}
            className="min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin</span>
          </button>
        </div>
      )}

      {/* Sculpted Public Financial Hero Banner */}
      <section
        aria-label="Public account balance overview"
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1c1c1c] via-[#261f1c] to-[#141414] dark:from-[#1c1c1c] dark:via-[#231d19] dark:to-[#141414] border border-[#303030] text-[#ffffff] p-6 sm:p-8 shadow-sm"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[#ff4f00]/22 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-[#ffc400]/16 blur-2xl"
        />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ffc400]">
                <Globe className="w-3.5 h-3.5 text-[#ff4f00] shrink-0" />
                <span>{org.orgName} · Public Financial Report</span>
              </div>
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

            <span className="px-3 py-1.5 rounded-full bg-[#ffffff]/12 text-xs font-medium text-[#ffffff] whitespace-nowrap">
              Read-only public view
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-5 border-t border-[#ffffff]/15">
            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 min-w-0 pb-3 sm:pb-0 border-b sm:border-b-0 border-[#ffffff]/15">
              <span className="w-10 h-10 rounded-full bg-[#ffc400]/20 text-[#ffc400] inline-flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-[#b8b8b8]">Opening Balance</div>
                <div className="font-num text-base sm:text-lg font-semibold text-[#ffffff] truncate">
                  {formatINR(org.openingBalance)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-0 sm:pl-4 sm:border-l sm:border-[#ffffff]/15">
              <span className="w-10 h-10 rounded-full bg-[#4ade80]/18 text-[#4ade80] inline-flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-[#b8b8b8]">Total Income</div>
                <div className="font-num text-base sm:text-lg font-semibold text-[#4ade80] truncate">
                  {formatINR(filteredIncomeTotal)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 min-w-0 pl-4 border-l border-[#ffffff]/15">
              <span className="w-10 h-10 rounded-full bg-[#ff4f00]/22 text-[#ff7a3d] inline-flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-[#b8b8b8]">Total Expenses</div>
                <div className="font-num text-base sm:text-lg font-semibold text-[#ff7a3d] truncate">
                  {formatINR(filteredExpensesTotal)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[#b8b8b8] pt-1">
            <span>Balance = Opening Balance + All-time Income − All-time Expenses</span>
            <span className="break-words">{activeScopeLabel}</span>
          </div>
        </div>
      </section>

      {/* Programmes Summary Strip */}
      {programs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#e6e2da] dark:border-[#303030]">
            <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
              Programmes ({programs.length})
            </h2>
            {programFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setProgramFilter('all')}
                className="text-xs font-semibold text-[#d94300] dark:text-[#ffc400] hover:underline cursor-pointer"
              >
                Show all programmes
              </button>
            )}
          </div>

          <div className="divide-y divide-[#efeae2] dark:divide-[#303030]">
            {programs.map((prog) => {
              const progInc = income
                .filter((i) => i.programId === prog.id)
                .reduce((s, i) => s + i.amount, 0);
              const progExp = expenses
                .filter((e) => e.programId === prog.id)
                .reduce((s, e) => s + e.amount, 0);
              const isSelected = programFilter === prog.id;

              return (
                <button
                  key={prog.id}
                  type="button"
                  onClick={() => setProgramFilter(isSelected ? 'all' : prog.id)}
                  className={`w-full text-left py-3.5 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#fff3eb] dark:bg-[#262626]'
                      : 'hover:bg-[#f1eee9] dark:hover:bg-[#1c1c1c]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-[#fff3eb] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] inline-flex items-center justify-center shrink-0">
                      <CalendarRange className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#1c1c1c] dark:text-[#ffffff] break-words">
                          {prog.name}
                        </span>
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                            prog.status === 'open'
                              ? 'bg-[#fff3eb] text-[#d94300] dark:bg-[#332908] dark:text-[#ffc400]'
                              : 'bg-[#ebe7e0] text-[#5c5852] dark:bg-[#262626] dark:text-[#b8b8b8]'
                          }`}
                        >
                          {prog.status === 'open' ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <div className="font-num text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-0.5">
                        {formatDisplayDate(prog.date)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs sm:text-sm font-num shrink-0 pl-12 sm:pl-0">
                    <div>
                      <span className="text-[#5c5852] dark:text-[#b8b8b8] mr-1">In:</span>
                      <span className="font-semibold text-[#15803d] dark:text-[#4ade80]">
                        {formatINR(progInc)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#5c5852] dark:text-[#b8b8b8] mr-1">Out:</span>
                      <span className="font-semibold text-[#ff4f00] dark:text-[#ff7a3d]">
                        {formatINR(progExp)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Read-Only Public Ledger */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <div className="pb-4 border-b border-[#efeae2] dark:border-[#303030]">
          <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
            Public Ledger
          </h2>
          <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-0.5">
            Showing <span className="font-num font-medium">{visibleEntries.length}</span>{' '}
            {visibleEntries.length === 1 ? 'entry' : 'entries'} · newest first
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
          <div>
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Month
            </label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            >
              <option value="all">All months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Programme
            </label>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            >
              <option value="all">All programmes</option>
              <option value="none">General (no programme)</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.status === 'closed' ? '(Closed)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Type
            </label>
            <div className="flex p-1 rounded-lg bg-[#f1eee9] dark:bg-[#121212] border border-[#e6e2da] dark:border-[#303030]">
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`flex-1 min-h-[36px] text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    typeFilter === t
                      ? 'bg-[#ffffff] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] shadow-xs'
                      : 'text-[#5c5852] dark:text-[#b8b8b8]'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'income' ? 'Income' : 'Expense'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#5c5852] dark:text-[#b8b8b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Note, category, amount"
                className="w-full min-h-[44px] pl-9 pr-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
              />
            </div>
          </div>
        </div>

        {/* Entries */}
        {visibleEntries.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-lg border border-dashed border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3]/60 dark:bg-[#121212]/50">
            <p className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff]">
              No entries match the current filters
            </p>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              Try choosing a different month, programme, or search term.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#efeae2] dark:divide-[#303030] border-t border-[#efeae2] dark:border-[#303030]">
            {visibleEntries.map((item) => {
              const program = item.programId ? programsMap.get(item.programId) : undefined;
              const late = isLateEntry(item, programsMap);
              const addedByName = userNames[item.addedBy] || 'Unit member';

              return (
                <article
                  key={`${item.type}-${item.id}`}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="font-num text-xs text-[#5c5852] dark:text-[#b8b8b8] shrink-0">
                        {formatDisplayDate(item.date)}
                      </span>
                      <span className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff] break-words">
                        {item.note || item.category}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                      <span className="px-2 py-0.5 rounded bg-[#f1eee9] dark:bg-[#262626] text-[#1c1c1c] dark:text-[#d4d4d4] font-medium">
                        {item.category}
                      </span>
                      {program && (
                        <span className="px-2 py-0.5 rounded bg-[#fff3eb] dark:bg-[#332908] text-[#d94300] dark:text-[#ffc400] font-medium break-words">
                          {program.name}
                        </span>
                      )}
                      {late && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#fff8dc] dark:bg-[#332908] text-[#926000] dark:text-[#ffc400] font-medium">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Added after programme ended</span>
                        </span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="break-words">Added by {addedByName}</span>
                    </div>
                  </div>

                  <div
                    className={`font-num text-base font-semibold whitespace-nowrap shrink-0 ${
                      item.type === 'income'
                        ? 'text-[#15803d] dark:text-[#4ade80]'
                        : 'text-[#ff4f00] dark:text-[#ff7a3d]'
                    }`}
                  >
                    {item.type === 'income'
                      ? formatINR(item.amount, true)
                      : `-${formatINR(item.amount)}`}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Open Analytics Breakdown */}
      <AnalyticsSection
        filteredExpenses={filteredExpensesList}
        scopedIncomeForSixMonths={scopedIncomeForSixMonths}
        scopedExpensesForSixMonths={scopedExpensesForSixMonths}
        monthFilter={monthFilter}
      />
    </main>
  );
}
