import { useState, type FormEvent } from 'react';
import { CheckCircle2, PlusCircle } from 'lucide-react';
import type { CommitteeMember, Loan, Program } from '../types';
import {
  formatDisplayDate,
  formatINR,
  getLoanPendingTotal,
  getLoanRepaidTotal,
  getLoanStatus,
  getTodayISO,
} from '../utils/format';
import { ConfirmButton } from './ConfirmButton';

interface LoansSectionProps {
  loans: Loan[];
  committee: CommitteeMember[];
  programs: Program[];
  programsMap: Map<string, Program>;
  userNames: Record<string, string>;
  programFilter: string;
  onProgramFilterChange: (val: string) => void;
  onCreateLoan: (payload: {
    name: string;
    source: 'committee' | 'outside';
    amount: number;
    date: string;
    programId: string | null;
    note: string;
  }) => Promise<void>;
  onAddRepayment: (loanId: string, payload: { amount: number; date: string }) => Promise<void>;
  onDeleteLoan: (loanId: string) => Promise<void>;
}

const BORROW_UNIT_COMMITTEE = '__UNIT_COMMITTEE__';
const BORROW_SOMEONE_ELSE = '__SOMEONE_ELSE__';

export function LoansSection({
  loans,
  committee,
  programs,
  programsMap,
  userNames,
  programFilter,
  onProgramFilterChange,
  onCreateLoan,
  onAddRepayment,
  onDeleteLoan,
}: LoansSectionProps) {
  const [borrowedFrom, setBorrowedFrom] = useState<string>(BORROW_UNIT_COMMITTEE);
  const [customLenderName, setCustomLenderName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [programId, setProgramId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'not_repaid' | 'repaid'>('all');

  // Inline repayment form state
  const [repayLoanId, setRepayLoanId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(getTodayISO());
  const [repayError, setRepayError] = useState<string | null>(null);
  const [repayBusy, setRepayBusy] = useState(false);

  const handleCreateLoan = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Loan amount must be greater than zero.');
      return;
    }

    let lenderName = '';
    let source: 'committee' | 'outside' = 'committee';

    if (borrowedFrom === BORROW_UNIT_COMMITTEE) {
      lenderName = 'Unit committee';
      source = 'committee';
    } else if (borrowedFrom === BORROW_SOMEONE_ELSE) {
      lenderName = customLenderName.trim();
      source = 'outside';
      if (!lenderName) {
        setFormError('Enter the lender name.');
        return;
      }
    } else {
      const member = committee.find((m) => m.id === borrowedFrom);
      if (!member) {
        setFormError('Select who the money was borrowed from.');
        return;
      }
      lenderName = member.name;
      source = 'committee';
    }

    setSubmitting(true);
    try {
      await onCreateLoan({
        name: lenderName,
        source,
        amount: parsedAmount,
        date,
        programId: programId || null,
        note: note.trim(),
      });
      setAmount('');
      setCustomLenderName('');
      setNote('');
      setFormNotice('Loan recorded. Remember: loan money is tracked separately and is not added to the unit balance.');
      setTimeout(() => setFormNotice(null), 5000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record loan.');
    } finally {
      setSubmitting(false);
    }
  };

  const openRepayForm = (loan: Loan) => {
    const remaining = getLoanPendingTotal(loan);
    setRepayLoanId(loan.id);
    setRepayAmount(String(remaining));
    setRepayDate(getTodayISO());
    setRepayError(null);
  };

  const handleRecordRepayment = async (e: FormEvent, loan: Loan) => {
    e.preventDefault();
    setRepayError(null);
    const remaining = getLoanPendingTotal(loan);
    const parsed = Number(repayAmount);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRepayError('Enter a repayment amount greater than zero.');
      return;
    }
    if (parsed > remaining + 0.001) {
      setRepayError(`Repayment cannot exceed the remaining balance (${formatINR(remaining)}).`);
      return;
    }

    setRepayBusy(true);
    try {
      await onAddRepayment(loan.id, { amount: parsed, date: repayDate });
      setRepayLoanId(null);
    } catch (err) {
      setRepayError(err instanceof Error ? err.message : 'Failed to record repayment.');
    } finally {
      setRepayBusy(false);
    }
  };

  const handleMarkFullyRepaid = async (loan: Loan) => {
    const remaining = getLoanPendingTotal(loan);
    if (remaining <= 0) return;
    setRepayBusy(true);
    try {
      await onAddRepayment(loan.id, { amount: remaining, date: getTodayISO() });
      if (repayLoanId === loan.id) setRepayLoanId(null);
    } finally {
      setRepayBusy(false);
    }
  };

  const programScopedLoans = loans.filter((loan) => {
    if (programFilter === 'all') return true;
    if (programFilter === 'none') return !loan.programId;
    return loan.programId === programFilter;
  });

  const filteredLoans = programScopedLoans.filter((loan) => {
    const status = getLoanStatus(loan);
    if (statusFilter === 'all') return true;
    if (statusFilter === 'repaid') return status === 'repaid';
    return status !== 'repaid';
  });

  const totalBorrowed = programScopedLoans.reduce((s, l) => s + l.amount, 0);
  const totalRepaid = programScopedLoans.reduce((s, l) => s + getLoanRepaidTotal(l), 0);
  const totalStillToRepay = programScopedLoans.reduce((s, l) => s + getLoanPendingTotal(l), 0);

  return (
    <div className="space-y-6">
      {/* Totals Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-5">
          <div className="text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8]">Borrowed</div>
          <div className="font-num text-2xl font-semibold text-[#1c1c1c] dark:text-[#ffffff] mt-1">
            {formatINR(totalBorrowed)}
          </div>
          <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
            Not added to unit cash balance
          </div>
        </div>
        <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-5">
          <div className="text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8]">Repaid</div>
          <div className="font-num text-2xl font-semibold text-[#15803d] dark:text-[#4ade80] mt-1">
            {formatINR(totalRepaid)}
          </div>
          <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
            Total returned so far
          </div>
        </div>
        <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#ffc9ad] dark:border-[#ff4f00]/50 p-4 sm:p-5">
          <div className="text-xs font-medium text-[#d94300] dark:text-[#ffc400]">
            Still to repay
          </div>
          <div className="font-num text-2xl font-semibold text-[#ff4f00] dark:text-[#ffc400] mt-1">
            {formatINR(totalStillToRepay)}
          </div>
          <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
            Outstanding across selected scope
          </div>
        </div>
      </div>

      {/* Record Loan Form */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
          Record Money Borrowed
        </h2>
        <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
          Loans are visible only to the finance admin and are tracked separately from income and cash balance.
        </p>

        {formError && (
          <div className="mt-3 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5]">
            {formError}
          </div>
        )}
        {formNotice && (
          <div className="mt-3 p-3 rounded-lg bg-[#ecfdf3] dark:bg-[#132a1c] border border-[#bbf7d0] dark:border-[#1f4d30] text-sm text-[#15803d] dark:text-[#4ade80]">
            {formNotice}
          </div>
        )}

        <form onSubmit={handleCreateLoan} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                Borrowed from
              </label>
              <select
                value={borrowedFrom}
                onChange={(e) => setBorrowedFrom(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
              >
                <option value={BORROW_UNIT_COMMITTEE}>Unit committee</option>
                {committee.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} (Committee)
                  </option>
                ))}
                <option value={BORROW_SOMEONE_ELSE}>Someone else (type name)</option>
              </select>
            </div>

            {borrowedFrom === BORROW_SOMEONE_ELSE && (
              <div>
                <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                  Lender name
                </label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={customLenderName}
                  onChange={(e) => setCustomLenderName(e.target.value)}
                  placeholder="Enter person or shop name"
                  className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                Date taken
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                Programme (optional)
              </label>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
              >
                <option value="">General (no programme)</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                Note (optional)
              </label>
              <input
                type="text"
                maxLength={400}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason or repayment terms"
                className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-6 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Record loan'}
            </button>
          </div>
        </form>
      </section>

      {/* Loans List & Filters */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#efeae2] dark:border-[#303030]">
          <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
            Loans Taken ({filteredLoans.length})
          </h2>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="inline-flex p-1 rounded-lg bg-[#f1eee9] dark:bg-[#121212] border border-[#e6e2da] dark:border-[#303030]">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'not_repaid', label: 'Not repaid' },
                  { id: 'repaid', label: 'Repaid' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[38px] px-3 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-[#ffffff] dark:bg-[#262626] text-[#ff4f00] dark:text-[#ffc400] shadow-xs'
                      : 'text-[#5c5852] dark:text-[#b8b8b8]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter loans by programme"
              value={programFilter}
              onChange={(e) => onProgramFilterChange(e.target.value)}
              className="min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-xs sm:text-sm text-[#1c1c1c] dark:text-[#ffffff]"
            >
              <option value="all">All programmes</option>
              <option value="none">General (no programme)</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredLoans.length === 0 ? (
          <div className="py-10 px-4 mt-4 text-center rounded-lg border border-dashed border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3]/60 dark:bg-[#121212]/50">
            <p className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff]">
              No loans found for the selected filter
            </p>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              Record a loan above or change the status and programme filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#efeae2] dark:divide-[#303030]">
            {filteredLoans.map((loan) => {
              const repaid = getLoanRepaidTotal(loan);
              const pending = getLoanPendingTotal(loan);
              const status = getLoanStatus(loan);
              const program = loan.programId ? programsMap.get(loan.programId) : undefined;
              const isRepaying = repayLoanId === loan.id;

              const statusLabel =
                status === 'repaid'
                  ? 'Repaid'
                  : status === 'part_repaid'
                    ? 'Part repaid'
                    : 'Not repaid';

              const statusClasses =
                status === 'repaid'
                  ? 'bg-[#ecfdf3] text-[#15803d] dark:bg-[#132a1c] dark:text-[#4ade80]'
                  : status === 'part_repaid'
                    ? 'bg-[#fff8dc] text-[#926000] dark:bg-[#332908] dark:text-[#ffc400]'
                    : 'bg-[#fff3eb] text-[#d94300] dark:bg-[#331c12] dark:text-[#ff7a3d]';

              return (
                <article key={loan.id} className="py-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff] break-words">
                          {loan.name}
                        </h3>
                        {loan.source === 'committee' && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#f1eee9] text-[#1c1c1c] dark:bg-[#262626] dark:text-[#ffc400]">
                            Committee
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusClasses}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                        <span className="font-num">{formatDisplayDate(loan.date)}</span>
                        {program && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#d94300] dark:text-[#ffc400] font-medium break-words">
                              {program.name}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>Recorded by {userNames[loan.addedBy] || 'Finance Admin'}</span>
                      </div>

                      {loan.note && (
                        <p className="text-sm text-[#3f3c38] dark:text-[#d4d4d4] break-words">
                          {loan.note}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 shrink-0">
                      <div className="text-left md:text-right">
                        <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">Borrowed</div>
                        <div className="font-num text-sm font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
                          {formatINR(loan.amount)}
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">Repaid</div>
                        <div className="font-num text-sm font-semibold text-[#15803d] dark:text-[#4ade80]">
                          {formatINR(repaid)}
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                          Still to repay
                        </div>
                        <div className="font-num text-base font-semibold text-[#ff4f00] dark:text-[#ffc400]">
                          {formatINR(pending)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Repayment history */}
                  {loan.repayments.length > 0 && (
                    <div className="rounded-lg bg-[#f7f6f3] dark:bg-[#121212]/80 border border-[#e6e2da] dark:border-[#303030] p-3">
                      <div className="text-xs font-semibold text-[#5c5852] dark:text-[#b8b8b8] mb-1.5">
                        Repayment history ({loan.repayments.length})
                      </div>
                      <ul className="space-y-1 text-xs">
                        {loan.repayments.map((rep) => (
                          <li
                            key={rep.id}
                            className="flex items-center justify-between gap-2 text-[#1c1c1c] dark:text-[#ffffff]"
                          >
                            <span className="font-num text-[#5c5852] dark:text-[#b8b8b8]">
                              {formatDisplayDate(rep.date)}
                            </span>
                            <span className="font-num font-medium text-[#15803d] dark:text-[#4ade80]">
                              {formatINR(rep.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Inline repayment form */}
                  {isRepaying && pending > 0 && (
                    <form
                      onSubmit={(e) => handleRecordRepayment(e, loan)}
                      className="p-3.5 rounded-lg bg-[#f7f6f3] dark:bg-[#121212] border border-[#d6d1c7] dark:border-[#3f3f3f] space-y-3"
                    >
                      <div className="text-xs font-semibold text-[#d94300] dark:text-[#ffc400]">
                        Record repayment (max {formatINR(pending)})
                      </div>
                      {repayError && (
                        <div className="text-xs text-[#b91c1c] dark:text-[#f87171]">
                          {repayError}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="block text-xs text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                            Repayment amount (₹)
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            max={pending}
                            required
                            value={repayAmount}
                            onChange={(e) => setRepayAmount(e.target.value)}
                            className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#1c1c1c] text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            required
                            value={repayDate}
                            onChange={(e) => setRepayDate(e.target.value)}
                            className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#1c1c1c] text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={repayBusy}
                            className="min-h-[44px] px-4 rounded-lg text-xs font-semibold cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50"
                          >
                            {repayBusy ? 'Saving...' : 'Save repayment'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRepayLoanId(null)}
                            className="min-h-[44px] px-3 rounded-lg text-xs font-medium cursor-pointer border border-[#d6d1c7] dark:border-[#3f3f3f] text-[#5c5852] dark:text-[#b8b8b8]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* Loan actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {pending > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => openRepayForm(loan)}
                          className="min-h-[44px] px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626] whitespace-nowrap cursor-pointer transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Record repayment</span>
                        </button>
                        <button
                          type="button"
                          disabled={repayBusy}
                          onClick={() => handleMarkFullyRepaid(loan)}
                          className="min-h-[44px] px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-[#bbf7d0] dark:border-[#1f4d30] text-[#15803d] dark:text-[#4ade80] hover:bg-[#ecfdf3] dark:hover:bg-[#132a1c] whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark fully repaid</span>
                        </button>
                      </>
                    )}

                    <ConfirmButton
                      label="Delete loan"
                      confirmLabel="Confirm delete"
                      onConfirm={() => onDeleteLoan(loan.id)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
