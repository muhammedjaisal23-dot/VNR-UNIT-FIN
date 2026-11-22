import { useState, type FormEvent } from 'react';
import { Download, FileText, Pencil, Plus, Search, AlertTriangle } from 'lucide-react';
import {
  getCategoryOptions,
  type LedgerItem,
  type Program,
} from '../types';
import {
  formatDisplayDate,
  formatINR,
  formatMonthLabel,
  isLateEntry,
} from '../utils/format';
import { ConfirmButton } from './ConfirmButton';

interface LedgerSectionProps {
  entries: LedgerItem[];
  allFilteredForReportCount: number;
  programs: Program[];
  programsMap: Map<string, Program>;
  customExpenseCategories: string[];
  customIncomeCategories: string[];
  onAddCustomCategory?: (type: 'income' | 'expense', name: string) => Promise<string>;
  userNames: Record<string, string>;
  availableMonths: string[];
  monthFilter: string;
  onMonthFilterChange: (val: string) => void;
  programFilter: string;
  onProgramFilterChange: (val: string) => void;
  typeFilter: 'all' | 'income' | 'expense';
  onTypeFilterChange: (val: 'all' | 'income' | 'expense') => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  onUpdateEntry: (
    type: 'income' | 'expense',
    id: string,
    payload: {
      date: string;
      amount: number;
      category: string;
      note: string;
      programId: string | null;
    }
  ) => Promise<void>;
  onDeleteEntry: (type: 'income' | 'expense', id: string) => Promise<void>;
  onExportCsv: () => void;
  onExportPdf: () => void;
  showPdfButton: boolean;
}

export function LedgerSection({
  entries,
  allFilteredForReportCount,
  programs,
  programsMap,
  customExpenseCategories,
  customIncomeCategories,
  onAddCustomCategory,
  userNames,
  availableMonths,
  monthFilter,
  onMonthFilterChange,
  programFilter,
  onProgramFilterChange,
  typeFilter,
  onTypeFilterChange,
  searchQuery,
  onSearchQueryChange,
  onUpdateEntry,
  onDeleteEntry,
  onExportCsv,
  onExportPdf,
  showPdfButton,
}: LedgerSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [addingEditCategory, setAddingEditCategory] = useState(false);
  const [editProgramId, setEditProgramId] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (item: LedgerItem) => {
    setEditingId(item.id);
    setEditDate(item.date);
    setEditAmount(String(item.amount));
    setEditCategory(item.category);
    setEditCustomCategory('');
    setEditProgramId(item.programId || '');
    setEditNote(item.note || '');
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCustomCategory('');
    setEditError(null);
  };

  const handleQuickAddEditCategory = async (type: 'income' | 'expense') => {
    setEditError(null);
    const cleaned = editCustomCategory.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setEditError(`Enter a name for the new ${type} category.`);
      return;
    }
    if (cleaned.toLowerCase() === 'other') {
      setEditError('Please enter a specific category name instead of "Other".');
      return;
    }
    if (!onAddCustomCategory) {
      setEditCategory(cleaned);
      setEditCustomCategory('');
      return;
    }
    setAddingEditCategory(true);
    try {
      const savedName = await onAddCustomCategory(type, cleaned);
      setEditCategory(savedName);
      setEditCustomCategory('');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not add category.');
    } finally {
      setAddingEditCategory(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent, item: LedgerItem) => {
    e.preventDefault();
    setEditError(null);
    const numAmount = Number(editAmount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setEditError('Amount must be greater than zero.');
      return;
    }

    let finalCategory = editCategory;
    if (editCategory === 'Other') {
      const cleanedCustom = editCustomCategory.trim().replace(/\s+/g, ' ');
      if (cleanedCustom) {
        if (cleanedCustom.toLowerCase() === 'other') {
          finalCategory = 'Other';
        } else {
          finalCategory = cleanedCustom;
        }
      } else if (item.category === 'Other') {
        finalCategory = 'Other';
      } else {
        setEditError(`Enter a name for the new ${item.type} category.`);
        return;
      }
    }

    setSavingEdit(true);
    try {
      await onUpdateEntry(item.type, item.id, {
        date: editDate,
        amount: numAmount,
        category: finalCategory,
        note: editNote.trim(),
        programId: editProgramId || null,
      });
      setEditingId(null);
      setEditCustomCategory('');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update entry.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#efeae2] dark:border-[#303030]">
        <div>
          <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
            Ledger
          </h2>
          <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-0.5">
            Showing <span className="font-num font-medium">{entries.length}</span>{' '}
            {entries.length === 1 ? 'entry' : 'entries'} · newest first
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={entries.length === 0}
            className="min-h-[44px] px-3.5 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#262626] text-[#1c1c1c] dark:text-[#ffffff] hover:bg-[#ebe7e0] dark:hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Save CSV</span>
          </button>

          {showPdfButton && allFilteredForReportCount > 0 && (
            <button
              type="button"
              onClick={onExportPdf}
              className="min-h-[44px] px-3.5 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] transition-colors"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Download PDF report</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
        <div>
          <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
            Month
          </label>
          <select
            value={monthFilter}
            onChange={(e) => onMonthFilterChange(e.target.value)}
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
            onChange={(e) => onProgramFilterChange(e.target.value)}
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
                onClick={() => onTypeFilterChange(t)}
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
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Note, category, amount, programme"
              className="w-full min-h-[44px] pl-9 pr-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            />
          </div>
        </div>
      </div>

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="py-10 px-4 text-center rounded-lg border border-dashed border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3]/60 dark:bg-[#121212]/50">
          <p className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff]">
            No entries match the current filters
          </p>
          <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
            Record an income or expense above, or broaden the month, programme, or search filters.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#efeae2] dark:divide-[#303030] border-t border-[#efeae2] dark:border-[#303030]">
          {entries.map((item) => {
            const program = item.programId ? programsMap.get(item.programId) : undefined;
            const late = isLateEntry(item, programsMap);
            const addedByName = userNames[item.addedBy] || 'Unknown user';
            const isEditing = editingId === item.id;

            if (isEditing) {
              const editCats = getCategoryOptions(
                item.type,
                item.type === 'income' ? customIncomeCategories : customExpenseCategories,
                item.category
              );
              return (
                <form
                  key={`${item.type}-${item.id}`}
                  onSubmit={(e) => handleSaveEdit(e, item)}
                  className="py-4 px-3 my-1 rounded-lg bg-[#f7f6f3] dark:bg-[#121212] border border-[#d6d1c7] dark:border-[#3f3f3f] space-y-3"
                >
                  <div className="text-xs font-semibold text-[#d94300] dark:text-[#ffc400]">
                    Editing {item.type === 'income' ? 'Income' : 'Expense'}
                  </div>

                  {editError && (
                    <div className="text-xs text-[#b91c1c] dark:text-[#f87171]">{editError}</div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
                    <div>
                      <label className="block text-xs text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        required
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#1c1c1c] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        required
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#1c1c1c] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                        Category
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => {
                          setEditCategory(e.target.value);
                          if (e.target.value !== 'Other') setEditCustomCategory('');
                        }}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#1c1c1c] text-sm"
                      >
                        {editCats.map((c) => (
                          <option key={c} value={c}>
                            {c === 'Other' ? 'Other (+ add new)' : c}
                          </option>
                        ))}
                      </select>

                      {editCategory === 'Other' && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            required={item.category !== 'Other'}
                            maxLength={60}
                            value={editCustomCategory}
                            onChange={(e) => setEditCustomCategory(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleQuickAddEditCategory(item.type);
                              }
                            }}
                            placeholder={
                              item.category === 'Other'
                                ? 'Optional: rename category'
                                : item.type === 'expense'
                                  ? 'New expense category'
                                  : 'New income category'
                            }
                            className="flex-1 min-w-0 min-h-[44px] px-3 rounded-lg border border-[#ffc9ad] dark:border-[#ff4f00]/50 bg-[#ffffff] dark:bg-[#1c1c1c] text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickAddEditCategory(item.type)}
                            disabled={addingEditCategory || !editCustomCategory.trim()}
                            className="min-h-[44px] px-3 inline-flex items-center gap-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-[#ff4f00] text-[#ffffff] dark:bg-[#ffc400] dark:text-[#1c1c1c] disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>Add</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                        Programme
                      </label>
                      <select
                        value={editProgramId}
                        onChange={(e) => setEditProgramId(e.target.value)}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#1c1c1c] text-sm"
                      >
                        <option value="">General (no programme)</option>
                        {programs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.status === 'closed' ? '(Closed)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      maxLength={400}
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#ffffff] dark:bg-[#1c1c1c] text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="min-h-[44px] px-4 rounded-lg text-xs font-semibold cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50"
                    >
                      {savingEdit ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={savingEdit}
                      className="min-h-[44px] px-4 rounded-lg text-xs font-medium cursor-pointer border border-[#d6d1c7] dark:border-[#3f3f3f] text-[#5c5852] dark:text-[#b8b8b8]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <article
                key={`${item.type}-${item.id}`}
                className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
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

                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                  <div
                    className={`font-num text-base font-semibold whitespace-nowrap ${
                      item.type === 'income'
                        ? 'text-[#15803d] dark:text-[#4ade80]'
                        : 'text-[#ff4f00] dark:text-[#ff7a3d]'
                    }`}
                  >
                    {item.type === 'income'
                      ? formatINR(item.amount, true)
                      : `-${formatINR(item.amount)}`}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="min-h-[44px] px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-[#d6d1c7] dark:border-[#303030] text-[#1c1c1c] dark:text-[#ffffff] hover:bg-[#ebe7e0] dark:hover:bg-[#262626] whitespace-nowrap cursor-pointer transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <ConfirmButton
                      label="Remove"
                      confirmLabel="Confirm remove"
                      onConfirm={() => onDeleteEntry(item.type, item.id)}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
