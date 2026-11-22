import type { EntryRecord, LedgerItem, Loan, Program } from '../types';

/**
 * Formats a number using the Indian numbering system (e.g. 1,25,000).
 */
export function formatIndianNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const hasDecimals = Math.round((abs % 1) * 100) !== 0;
  const fixed = hasDecimals ? abs.toFixed(2) : Math.round(abs).toString();
  const [intPart, decPart] = fixed.split('.');

  let formattedInt = intPart;
  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInt = `${groupedRest},${lastThree}`;
  }

  return `${negative ? '-' : ''}${formattedInt}${decPart ? `.${decPart}` : ''}`;
}

export function formatINR(value: number, showSign = false): string {
  const safe = Number.isFinite(value) ? value : 0;
  const absFormatted = formatIndianNumber(Math.abs(safe));
  if (safe < 0) return `-₹${absFormatted}`;
  if (showSign && safe > 0) return `+₹${absFormatted}`;
  return `₹${absFormatted}`;
}

export function formatINRPdf(value: number, showSign = false): string {
  const safe = Number.isFinite(value) ? value : 0;
  const absFormatted = formatIndianNumber(Math.abs(safe));
  if (safe < 0) return `-Rs. ${absFormatted}`;
  if (showSign && safe > 0) return `+Rs. ${absFormatted}`;
  return `Rs. ${absFormatted}`;
}

export function getTodayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getCurrentMonthKey(): string {
  return getTodayISO().slice(0, 7);
}

export function formatDisplayDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMonthLabel(monthKey: string): string {
  if (!monthKey || monthKey === 'all') return 'All months';
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function formatShortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export function getLastSixMonths(): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    result.push(`${yyyy}-${mm}`);
  }
  return result;
}

export function getLoanRepaidTotal(loan: Loan): number {
  return (loan.repayments || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

export function getLoanPendingTotal(loan: Loan): number {
  return Math.max(0, Number(loan.amount) - getLoanRepaidTotal(loan));
}

export function getLoanStatus(loan: Loan): 'not_repaid' | 'part_repaid' | 'repaid' {
  const repaid = getLoanRepaidTotal(loan);
  if (repaid <= 0) return 'not_repaid';
  if (repaid >= loan.amount) return 'repaid';
  return 'part_repaid';
}

export function isLateEntry(entry: EntryRecord, programsMap: Map<string, Program>): boolean {
  if (!entry.programId) return false;
  const program = programsMap.get(entry.programId);
  if (!program || program.status !== 'closed' || !program.closedAt) return false;
  return entry.timestamp > program.closedAt;
}

/**
 * Replaces currency symbol with Rs. and non-ASCII unsupported characters (e.g. Malayalam) with "?".
 */
export function sanitizePdfText(text: string): string {
  if (!text) return '';
  return text
    .replace(/₹/g, 'Rs. ')
    .replace(/[–—]/g, '-')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .trim();
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportLedgerCsv(params: {
  orgName: string;
  entries: LedgerItem[];
  programsMap: Map<string, Program>;
  userNames: Record<string, string>;
  monthFilter: string;
  programFilter: string;
}) {
  const { orgName, entries, programsMap, userNames, monthFilter, programFilter } = params;
  const headers = [
    'Date',
    'Type',
    'Category',
    'Programme',
    'Description',
    'Added By',
    'Amount (INR)',
    'Late Entry Flag',
  ];

  const rows = entries.map((entry) => {
    const program = entry.programId ? programsMap.get(entry.programId) : undefined;
    const late = isLateEntry(entry, programsMap) ? 'Added after programme ended' : '';
    const signedAmount = entry.type === 'income' ? entry.amount : -entry.amount;
    return [
      entry.date,
      entry.type === 'income' ? 'Income' : 'Expense',
      entry.category,
      program ? program.name : 'General',
      entry.note || '',
      userNames[entry.addedBy] || 'Unknown user',
      signedAmount,
      late,
    ].map(escapeCsvCell);
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unit-finance';
  const periodPart = monthFilter === 'all' ? 'all-months' : monthFilter;
  const progPart = programFilter === 'all' ? 'all-programmes' : programFilter;
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}-ledger-${periodPart}-${progPart}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
