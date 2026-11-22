import { AlertCircle } from 'lucide-react';
import type { AuthUser, EntryRecord, Program } from '../types';
import { formatDisplayDate, formatINR } from '../utils/format';
import { ConfirmButton } from './ConfirmButton';
import { EntryForm } from './EntryForm';

interface SecretaryViewProps {
  programIdFromLink: string | null;
  program: Program | undefined;
  expenses: EntryRecord[];
  customExpenseCategories: string[];
  onAddCustomCategory: (type: 'income' | 'expense', name: string) => Promise<string>;
  currentUser: AuthUser;
  userNames: Record<string, string>;
  onAddExpense: (
    type: 'income' | 'expense',
    payload: {
      date: string;
      amount: number;
      category: string;
      note: string;
      programId: string | null;
    }
  ) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

export function SecretaryView({
  programIdFromLink,
  program,
  expenses,
  customExpenseCategories,
  onAddCustomCategory,
  currentUser,
  userNames,
  onAddExpense,
  onDeleteExpense,
}: SecretaryViewProps) {
  if (!programIdFromLink) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-6 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-[#ff4f00] dark:text-[#ffc400] mx-auto" />
          <h1 className="text-lg font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
            Programme link required
          </h1>
          <p className="text-sm text-[#5c5852] dark:text-[#b8b8b8] max-w-md mx-auto">
            As a secretary, please open the specific programme link sent to you by the finance admin to record expenses.
          </p>
        </div>
      </main>
    );
  }

  if (!program) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-6 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-[#dc2626] dark:text-[#f87171] mx-auto" />
          <h1 className="text-lg font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
            Programme link is invalid
          </h1>
          <p className="text-sm text-[#5c5852] dark:text-[#b8b8b8] max-w-md mx-auto">
            This programme could not be found. Please ask the finance admin for an updated link.
          </p>
        </div>
      </main>
    );
  }

  if (program.status !== 'open') {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-6 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-[#ff4f00] dark:text-[#ffc400] mx-auto" />
          <h1 className="text-lg font-semibold text-[#1c1c1c] dark:text-[#ffffff] break-words">
            {program.name} has ended
          </h1>
          <p className="font-num text-xs text-[#5c5852] dark:text-[#b8b8b8]">
            Programme date: {formatDisplayDate(program.date)}
          </p>
          <p className="text-sm text-[#5c5852] dark:text-[#b8b8b8] max-w-md mx-auto pt-1">
            This programme is closed, so new expenses can no longer be submitted here. Contact the finance admin if a late correction is needed.
          </p>
        </div>
      </main>
    );
  }

  const programExpenses = expenses
    .filter((e) => e.programId === program.id)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.timestamp - a.timestamp;
    });

  const totalSpent = programExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Programme header & total spent */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[#d94300] dark:text-[#ffc400]">
            Programme Expense Sheet
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1c1c1c] dark:text-[#ffffff] mt-0.5 break-words">
            {program.name}
          </h1>
          <p className="font-num text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
            Date: {formatDisplayDate(program.date)}
          </p>
        </div>

        <div className="sm:text-right shrink-0">
          <div className="text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8]">
            Total spent so far
          </div>
          <div className="font-num text-2xl sm:text-3xl font-bold text-[#ff4f00] dark:text-[#ff7a3d] mt-0.5">
            {formatINR(totalSpent)}
          </div>
        </div>
      </section>

      {/* Expense submission form */}
      <EntryForm
        mode="secretary"
        openPrograms={[program]}
        fixedProgramId={program.id}
        customExpenseCategories={customExpenseCategories}
        onAddCustomCategory={onAddCustomCategory}
        onSubmit={onAddExpense}
      />

      {/* Programme's expenses only */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff] mb-3">
          Expenses for {program.name} ({programExpenses.length})
        </h2>

        {programExpenses.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-lg border border-dashed border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3]/60 dark:bg-[#121212]/50 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
            No expenses recorded for this programme yet.
          </div>
        ) : (
          <div className="divide-y divide-[#efeae2] dark:divide-[#303030]">
            {programExpenses.map((entry) => {
              const canDelete = entry.addedBy === currentUser.id && program.status === 'open';
              return (
                <article
                  key={entry.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="font-num text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                        {formatDisplayDate(entry.date)}
                      </span>
                      <span className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff] break-words">
                        {entry.note || entry.category}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                      <span className="px-2 py-0.5 rounded bg-[#f1eee9] dark:bg-[#262626] text-[#1c1c1c] dark:text-[#d4d4d4] font-medium">
                        {entry.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Added by {userNames[entry.addedBy] || 'Unknown user'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="font-num text-base font-semibold text-[#ff4f00] dark:text-[#ff7a3d]">
                      -{formatINR(entry.amount)}
                    </span>
                    {canDelete && (
                      <ConfirmButton
                        label="Remove"
                        confirmLabel="Confirm remove"
                        onConfirm={() => onDeleteExpense(entry.id)}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
