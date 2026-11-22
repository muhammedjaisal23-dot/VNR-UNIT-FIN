import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getCategoryOptions,
  type Program,
} from '../types';
import { getTodayISO } from '../utils/format';

interface EntryFormProps {
  mode: 'admin' | 'secretary';
  openPrograms: Program[];
  fixedProgramId?: string;
  customExpenseCategories?: string[];
  customIncomeCategories?: string[];
  onAddCustomCategory?: (type: 'income' | 'expense', name: string) => Promise<string>;
  onSubmit: (
    type: 'income' | 'expense',
    payload: {
      date: string;
      amount: number;
      category: string;
      note: string;
      programId: string | null;
    }
  ) => Promise<void>;
}

export function EntryForm({
  mode,
  openPrograms,
  fixedProgramId,
  customExpenseCategories = [],
  customIncomeCategories = [],
  onAddCustomCategory,
  onSubmit,
}: EntryFormProps) {
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(getTodayISO());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [programId, setProgramId] = useState<string>(fixedProgramId || '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeType = mode === 'secretary' ? 'expense' : entryType;
  const activeCustomList =
    activeType === 'expense' ? customExpenseCategories : customIncomeCategories;
  const categories = getCategoryOptions(
    activeType,
    activeCustomList,
    category !== 'Other' ? category : undefined
  );

  const handleTypeChange = (nextType: 'expense' | 'income') => {
    setEntryType(nextType);
    setCategory(nextType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
    setCustomCategory('');
    setError(null);
  };

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    if (nextCategory !== 'Other') {
      setCustomCategory('');
    }
    setError(null);
  };

  const handleQuickAddCategory = async () => {
    setError(null);
    const cleaned = customCategory.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setError(`Type a name for the new ${activeType} category first.`);
      return;
    }
    if (cleaned.toLowerCase() === 'other') {
      setError('Please enter a specific category name instead of "Other".');
      return;
    }

    if (!onAddCustomCategory) {
      setCategory(cleaned);
      setCustomCategory('');
      return;
    }

    setAddingCategory(true);
    try {
      const savedName = await onAddCustomCategory(activeType, cleaned);
      setCategory(savedName);
      setCustomCategory('');
      setSuccess(`"${savedName}" added to ${activeType} categories.`);
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category.');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!date) {
      setError('Choose a date.');
      return;
    }

    let finalCategory = category;
    if (category === 'Other') {
      const cleanedCustom = customCategory.trim().replace(/\s+/g, ' ');
      if (!cleanedCustom) {
        setError(`Enter a name for the new ${activeType} category.`);
        return;
      }
      if (cleanedCustom.toLowerCase() === 'other') {
        setError('Please enter a specific category name instead of "Other".');
        return;
      }
      const existingMatch = categories.find(
        (c) => c.toLowerCase() === cleanedCustom.toLowerCase()
      );
      finalCategory = existingMatch || cleanedCustom;
    }

    const effectiveProgramId =
      mode === 'secretary' ? fixedProgramId || null : programId || null;

    setSubmitting(true);
    try {
      await onSubmit(activeType, {
        date,
        amount: parsedAmount,
        category: finalCategory,
        note: note.trim(),
        programId: effectiveProgramId,
      });
      setAmount('');
      setNote('');
      if (category === 'Other') {
        setCategory(finalCategory);
        setCustomCategory('');
      }
      setSuccess(
        category === 'Other'
          ? `${activeType === 'income' ? 'Income' : 'Expense'} recorded and "${finalCategory}" added to categories.`
          : activeType === 'income'
            ? 'Income recorded.'
            : 'Expense recorded.'
      );
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
          {mode === 'secretary' ? 'Record Programme Expense' : 'Record Entry'}
        </h2>

        {mode === 'admin' && (
          <div
            role="tablist"
            aria-label="Entry type"
            className="inline-flex p-1 rounded-lg bg-[#f1eee9] dark:bg-[#121212] border border-[#e6e2da] dark:border-[#303030] self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeType === 'expense'}
              onClick={() => handleTypeChange('expense')}
              className={`min-h-[44px] px-4 rounded-md text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeType === 'expense'
                  ? 'bg-[#ff4f00] text-[#ffffff] dark:bg-[#ff6b2b] dark:text-[#1c1c1c]'
                  : 'text-[#5c5852] dark:text-[#b8b8b8] hover:text-[#1c1c1c] dark:hover:text-[#ffffff]'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeType === 'income'}
              onClick={() => handleTypeChange('income')}
              className={`min-h-[44px] px-4 rounded-md text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeType === 'income'
                  ? 'bg-[#15803d] text-[#ffffff] dark:bg-[#22c55e] dark:text-[#1c1c1c]'
                  : 'text-[#5c5852] dark:text-[#b8b8b8] hover:text-[#1c1c1c] dark:hover:text-[#ffffff]'
              }`}
            >
              Income
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5] break-words">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-[#ecfdf3] dark:bg-[#132a1c] border border-[#bbf7d0] dark:border-[#1f4d30] text-sm text-[#15803d] dark:text-[#4ade80]">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
          <div>
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

          <div className={category === 'Other' ? 'sm:col-span-2 lg:col-span-1' : ''}>
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'Other' ? 'Other (+ add new)' : cat}
                </option>
              ))}
            </select>

            {category === 'Other' && (
              <div className="mt-2.5 rounded-lg border border-[#ffc9ad] dark:border-[#ff4f00]/50 bg-[#fff3eb] dark:bg-[#262626] p-3 space-y-2">
                <label className="block text-xs font-semibold text-[#d94300] dark:text-[#ffc400]">
                  Add new {activeType} category
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickAddCategory();
                      }
                    }}
                    placeholder={
                      activeType === 'expense'
                        ? 'e.g. Electricity, Sound system'
                        : 'e.g. Sponsorship, Book sales'
                    }
                    className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddCategory}
                    disabled={addingCategory || !customCategory.trim()}
                    className="min-h-[44px] px-3.5 inline-flex items-center gap-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>{addingCategory ? 'Adding...' : 'Add'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#5c5852] dark:text-[#b8b8b8]">
                  Tap Add to save it to the {activeType} Category list now, or submit directly below.
                </p>
              </div>
            )}
          </div>

          {mode === 'admin' && (
            <div>
              <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                Programme (open only)
              </label>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
              >
                <option value="">General (no programme)</option>
                {openPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Description
            </label>
            <input
              type="text"
              maxLength={400}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                activeType === 'expense'
                  ? 'What was this expense for?'
                  : 'Source or reference note'
              }
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`min-h-[44px] px-6 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
              activeType === 'income'
                ? 'bg-[#15803d] text-[#ffffff] hover:bg-[#166534] dark:bg-[#22c55e] dark:text-[#1c1c1c] dark:hover:bg-[#4ade80]'
                : 'bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ff6b2b] dark:text-[#1c1c1c] dark:hover:bg-[#ff854f]'
            }`}
          >
            {submitting
              ? 'Saving...'
              : activeType === 'income'
                ? 'Add income'
                : 'Add expense'}
          </button>
        </div>
      </form>
    </section>
  );
}
