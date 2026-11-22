import type { EntryRecord } from '../types';
import {
  formatINR,
  formatMonthLabel,
  formatShortMonthLabel,
  getLastSixMonths,
} from '../utils/format';

interface AnalyticsSectionProps {
  filteredExpenses: EntryRecord[];
  scopedIncomeForSixMonths: EntryRecord[];
  scopedExpensesForSixMonths: EntryRecord[];
  monthFilter: string;
}

export function AnalyticsSection({
  filteredExpenses,
  scopedIncomeForSixMonths,
  scopedExpensesForSixMonths,
  monthFilter,
}: AnalyticsSectionProps) {
  // --- Expenses by category ---
  const categoryTotalsMap = new Map<string, number>();
  let totalFilteredExpenses = 0;
  for (const e of filteredExpenses) {
    categoryTotalsMap.set(e.category, (categoryTotalsMap.get(e.category) || 0) + e.amount);
    totalFilteredExpenses += e.amount;
  }
  const categoryRows = Array.from(categoryTotalsMap.entries()).sort((a, b) => b[1] - a[1]);

  // --- Month by month (last 6 months) ---
  const sixMonths = getLastSixMonths();
  const monthlyStats = sixMonths.map((monthKey) => {
    const inc = scopedIncomeForSixMonths
      .filter((i) => i.date.startsWith(monthKey))
      .reduce((s, i) => s + i.amount, 0);
    const exp = scopedExpensesForSixMonths
      .filter((e) => e.date.startsWith(monthKey))
      .reduce((s, e) => s + e.amount, 0);
    return { monthKey, label: formatShortMonthLabel(monthKey), income: inc, expense: exp };
  });

  const maxMonthlyVal = Math.max(
    1,
    ...monthlyStats.map((m) => Math.max(m.income, m.expense))
  );

  return (
    <div className="pt-6 border-t border-[#e6e2da] dark:border-[#303030] grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Expenses by Category — open editorial bars */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
              Expenses by Category
            </h2>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-0.5">
              {formatMonthLabel(monthFilter)}
            </p>
          </div>
          <span className="font-num text-sm font-semibold text-[#ff4f00] dark:text-[#ff7a3d]">
            {formatINR(totalFilteredExpenses)}
          </span>
        </div>

        {categoryRows.length === 0 ? (
          <div className="py-8 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
            No expenses recorded for this period yet.
          </div>
        ) : (
          <div className="space-y-3.5">
            {categoryRows.map(([cat, total]) => {
              const pct = totalFilteredExpenses > 0 ? (total / totalFilteredExpenses) * 100 : 0;
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-[#1c1c1c] dark:text-[#ffffff] font-medium break-words">
                      {cat}
                    </span>
                    <div className="font-num text-xs sm:text-sm shrink-0 flex items-baseline gap-2">
                      <span className="text-[#5c5852] dark:text-[#b8b8b8]">
                        {pct.toFixed(0)}%
                      </span>
                      <span className="font-semibold text-[#ff4f00] dark:text-[#ff7a3d]">
                        {formatINR(total)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-[#ebe7e0] dark:bg-[#262626] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#ff4f00] dark:bg-[#ff6b2b] transition-all duration-300"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Month by Month — sleek 6-month vertical column bar chart */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
              Month by Month
            </h2>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-0.5">
              Last 6 months income vs expenses
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#15803d] dark:bg-[#4ade80]" />
              Income
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff4f00] dark:bg-[#ff6b2b]" />
              Expense
            </span>
          </div>
        </div>

        {/* Vertical paired columns */}
        <div className="pt-2">
          <div className="grid grid-cols-6 gap-2 sm:gap-3 items-end h-40 pb-2 border-b border-[#e6e2da] dark:border-[#303030]">
            {monthlyStats.map((m) => {
              const incH = m.income > 0 ? Math.max((m.income / maxMonthlyVal) * 100, 8) : 4;
              const expH = m.expense > 0 ? Math.max((m.expense / maxMonthlyVal) * 100, 8) : 4;
              return (
                <div
                  key={m.monthKey}
                  className="h-full flex items-end justify-center gap-1 sm:gap-1.5"
                  title={`${m.label} — Income: ${formatINR(m.income)}, Expense: ${formatINR(m.expense)}`}
                >
                  <div
                    className={`w-3 sm:w-4 rounded-t-full transition-all duration-300 ${
                      m.income > 0
                        ? 'bg-[#15803d] dark:bg-[#4ade80]'
                        : 'bg-[#e3ded6] dark:bg-[#262626]'
                    }`}
                    style={{ height: `${incH}%` }}
                  />
                  <div
                    className={`w-3 sm:w-4 rounded-t-full transition-all duration-300 ${
                      m.expense > 0
                        ? 'bg-[#ff4f00] dark:bg-[#ff6b2b]'
                        : 'bg-[#e3ded6] dark:bg-[#262626]'
                    }`}
                    style={{ height: `${expH}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-6 gap-2 sm:gap-3 pt-2 text-center">
            {monthlyStats.map((m) => (
              <div key={m.monthKey} className="min-w-0">
                <div className="text-[11px] font-medium text-[#1c1c1c] dark:text-[#ffffff] truncate">
                  {m.label.split(' ')[0]}
                </div>
                <div className="font-num text-[10px] text-[#15803d] dark:text-[#4ade80] truncate">
                  {m.income > 0 ? formatINR(m.income) : '—'}
                </div>
                <div className="font-num text-[10px] text-[#ff4f00] dark:text-[#ff7a3d] truncate">
                  {m.expense > 0 ? formatINR(m.expense) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
