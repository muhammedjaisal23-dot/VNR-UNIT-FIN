import { useState, type FormEvent } from 'react';
import { Check, Copy, RotateCcw, Info } from 'lucide-react';
import type { EntryRecord, Loan, Program } from '../types';
import {
  formatDisplayDate,
  formatINR,
  getLoanPendingTotal,
  getTodayISO,
} from '../utils/format';
import { ConfirmButton } from './ConfirmButton';

interface ProgramsSectionProps {
  programs: Program[];
  income: EntryRecord[];
  expenses: EntryRecord[];
  loans: Loan[];
  onCreateProgram: (payload: { name: string; date: string }) => Promise<void>;
  onUpdateStatus: (id: string, status: 'open' | 'closed') => Promise<void>;
  onDeleteProgram: (id: string) => Promise<void>;
}

export function ProgramsSection({
  programs,
  income,
  expenses,
  loans,
  onCreateProgram,
  onUpdateStatus,
  onDeleteProgram,
}: ProgramsSectionProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fallbackLinkId, setFallbackLinkId] = useState<string | null>(null);

  const buildProgramLink = (id: string) => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}#p-${id}`;
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Enter a programme name.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreateProgram({ name: name.trim(), date });
      setName('');
      setDate(getTodayISO());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create programme.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async (programId: string) => {
    const url = buildProgramLink(programId);
    try {
      if (!navigator.clipboard || !window.isSecureContext) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(url);
      setCopiedId(programId);
      setFallbackLinkId(null);
      setTimeout(() => setCopiedId((curr) => (curr === programId ? null : curr)), 2500);
    } catch {
      setFallbackLinkId(programId);
      setCopiedId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add programme form */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
          Add Programme
        </h2>
        <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
          Create a programme to track its income, expenses, and loans, and share its expense link with an invited secretary.
        </p>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5]">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6">
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Programme name
            </label>
            <input
              type="text"
              required
              maxLength={140}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Unit Conference"
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] px-5 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create programme'}
            </button>
          </div>
        </form>
      </section>

      {/* Honest enforcement note */}
      <div className="rounded-lg border border-[#e6e2da] dark:border-[#303030] bg-[#ffffff]/80 dark:bg-[#1c1c1c]/80 px-4 py-3 flex items-start gap-2.5 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
        <Info className="w-4 h-4 text-[#ff4f00] dark:text-[#ffc400] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Ending a programme hides the submission form on the page for secretaries and removes it from the open-programme dropdown. Because closing is enforced in the page rather than blocked at the database level, any late entry submitted after a programme ended is automatically flagged in the Ledger for your review.
        </p>
      </div>

      {/* Programmes list */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff] mb-4">
          All Programmes ({programs.length})
        </h2>

        {programs.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-lg border border-dashed border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3]/60 dark:bg-[#121212]/50">
            <p className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff]">
              No programmes created yet
            </p>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              Add your first programme above to generate a secretary expense link.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#efeae2] dark:divide-[#303030]">
            {programs.map((program) => {
              const pIncome = income
                .filter((i) => i.programId === program.id)
                .reduce((s, i) => s + i.amount, 0);
              const pExpenses = expenses
                .filter((e) => e.programId === program.id)
                .reduce((s, e) => s + e.amount, 0);
              const pLoans = loans.filter((l) => l.programId === program.id);
              const pLoansTaken = pLoans.reduce((s, l) => s + l.amount, 0);
              const pLoansPending = pLoans.reduce((s, l) => s + getLoanPendingTotal(l), 0);
              const linkUrl = buildProgramLink(program.id);

              return (
                <div key={program.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff] break-words">
                          {program.name}
                        </h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            program.status === 'open'
                              ? 'bg-[#fff3eb] text-[#d94300] dark:bg-[#332908] dark:text-[#ffc400]'
                              : 'bg-[#ebe7e0] text-[#5c5852] dark:bg-[#262626] dark:text-[#b8b8b8]'
                          }`}
                        >
                          {program.status === 'open' ? 'Open' : 'Ended'}
                        </span>
                      </div>
                      <p className="font-num text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
                        Date: {formatDisplayDate(program.date)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(program.id)}
                        className="min-h-[44px] px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#262626] text-[#1c1c1c] dark:text-[#ffffff] hover:bg-[#ebe7e0] dark:hover:bg-[#333333] whitespace-nowrap cursor-pointer transition-colors"
                      >
                        {copiedId === program.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#15803d] dark:text-[#4ade80]" />
                            <span>Link copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy link</span>
                          </>
                        )}
                      </button>

                      {program.status === 'open' ? (
                        <ConfirmButton
                          label="End programme"
                          confirmLabel="Confirm end"
                          variant="warning"
                          onConfirm={() => onUpdateStatus(program.id, 'closed')}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(program.id, 'open')}
                          className="min-h-[44px] px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626] whitespace-nowrap cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reopen</span>
                        </button>
                      )}

                      <ConfirmButton
                        label="Delete"
                        confirmLabel="Confirm delete"
                        variant="danger"
                        onConfirm={async () => {
                          setError(null);
                          try {
                            await onDeleteProgram(program.id);
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : 'Failed to delete programme.'
                            );
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Selectable fallback link box if clipboard copy failed */}
                  {fallbackLinkId === program.id && (
                    <div className="p-3 rounded-lg bg-[#f7f6f3] dark:bg-[#121212] border border-[#d6d1c7] dark:border-[#3f3f3f] space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8]">
                          Clipboard copy unavailable — select and copy the link below:
                        </span>
                        <button
                          type="button"
                          onClick={() => setFallbackLinkId(null)}
                          className="text-xs text-[#d94300] dark:text-[#ffc400] underline cursor-pointer"
                        >
                          Hide
                        </button>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={linkUrl}
                        onFocus={(e) => e.currentTarget.select()}
                        className="font-num w-full min-h-[44px] px-3 rounded-md border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#1c1c1c] text-xs text-[#1c1c1c] dark:text-[#ffffff]"
                      />
                    </div>
                  )}

                  {/* Programme financial totals */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="p-2.5 rounded-lg bg-[#f7f6f3] dark:bg-[#121212]/80">
                      <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">Income</div>
                      <div className="font-num text-sm font-semibold text-[#15803d] dark:text-[#4ade80] mt-0.5">
                        {formatINR(pIncome)}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#f7f6f3] dark:bg-[#121212]/80">
                      <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">Expenses</div>
                      <div className="font-num text-sm font-semibold text-[#ff4f00] dark:text-[#ff7a3d] mt-0.5">
                        {formatINR(pExpenses)}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#f7f6f3] dark:bg-[#121212]/80">
                      <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">Loans taken</div>
                      <div className="font-num text-sm font-semibold text-[#1c1c1c] dark:text-[#ffffff] mt-0.5">
                        {formatINR(pLoansTaken)}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#f7f6f3] dark:bg-[#121212]/80">
                      <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">Still to repay</div>
                      <div className="font-num text-sm font-semibold text-[#d94300] dark:text-[#ffc400] mt-0.5">
                        {formatINR(pLoansPending)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
