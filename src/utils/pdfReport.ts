import type { LedgerItem, Loan, OrgMeta, Program } from '../types';
import {
  formatDisplayDate,
  formatINRPdf,
  formatMonthLabel,
  getLoanPendingTotal,
  getLoanRepaidTotal,
  getTodayISO,
  isLateEntry,
  sanitizePdfText,
} from './format';

declare global {
  interface Window {
    jspdf?: {
      jsPDF: new (options?: {
        orientation?: 'portrait' | 'landscape';
        unit?: 'mm' | 'pt' | 'in';
        format?: string | number[];
      }) => JsPdfInstance;
    };
  }
}

interface JsPdfInstance {
  internal: {
    pageSize: {
      getWidth: () => number;
      getHeight: () => number;
    };
  };
  getNumberOfPages: () => number;
  setPage: (page: number) => void;
  addPage: () => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (width: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  text: (
    text: string | string[],
    x: number,
    y: number,
    options?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }
  ) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  save: (filename: string) => void;
}

export function isJsPdfReady(): boolean {
  return typeof window !== 'undefined' && Boolean(window.jspdf?.jsPDF);
}

export interface PdfReportParams {
  org: OrgMeta;
  monthFilter: string;
  programFilter: string;
  programs: Program[];
  programsMap: Map<string, Program>;
  entries: LedgerItem[];
  loans: Loan[];
  userNames: Record<string, string>;
}

export function generateFinancePdfReport(params: PdfReportParams): boolean {
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) return false;

  const { org, monthFilter, programFilter, programs, programsMap, entries, loans, userNames } = params;

  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  const ACCENT: [number, number, number] = [255, 79, 0]; // Bold Orange #FF4F00
  const INK: [number, number, number] = [28, 28, 28]; // Deep Black #1C1C1C
  const MUTED: [number, number, number] = [92, 88, 82]; // Warm Charcoal
  const LINE: [number, number, number] = [230, 226, 218]; // Warm Neutral Divider
  const TINT: [number, number, number] = [255, 243, 235]; // Soft Bold Orange Tint
  const GREEN: [number, number, number] = [21, 128, 61]; // Positive Income Green
  const EXPENSE: [number, number, number] = [217, 67, 0]; // Deep Bold Orange Expense

  let y = 16;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      y = 16;
      return true;
    }
    return false;
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT);
    doc.text(sanitizePdfText(title), margin, y);
    y += 2;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.35);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  // --- Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...ACCENT);
  doc.text(sanitizePdfText(org.orgName || 'SSF VNR Unit Finance'), margin, y);
  y += 6;

  const programLabel =
    programFilter === 'all'
      ? 'All programmes'
      : programFilter === 'none'
        ? 'General (no programme)'
        : programsMap.get(programFilter)?.name || 'Selected programme';

  const periodLabel = formatMonthLabel(monthFilter);
  const generatedLabel = formatDisplayDate(getTodayISO());

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    sanitizePdfText(`Financial Report  |  Period: ${periodLabel}  |  Programme: ${programLabel}`),
    margin,
    y
  );
  y += 4.5;
  doc.text(sanitizePdfText(`Generated: ${generatedLabel}`), margin, y);
  y += 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // --- Summary ---
  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);
  const net = totalIncome - totalExpenses;
  const closingBalance = org.openingBalance + totalIncome - totalExpenses;

  drawSectionHeading('Summary');

  const summaryRows: Array<[string, string, [number, number, number]]> = [
    ['Opening balance', formatINRPdf(org.openingBalance), INK],
    ['Total income', formatINRPdf(totalIncome), GREEN],
    ['Total expenses', formatINRPdf(totalExpenses), EXPENSE],
    ['Net (income - expenses)', formatINRPdf(net, true), net >= 0 ? GREEN : EXPENSE],
    ['Closing balance (opening + income - expenses)', formatINRPdf(closingBalance), ACCENT],
  ];

  doc.setFillColor(...TINT);
  doc.setDrawColor(...LINE);
  doc.rect(margin, y - 1, contentWidth, summaryRows.length * 6.5 + 4, 'FD');
  y += 4.5;

  for (const [label, val, color] of summaryRows) {
    doc.setFont('helvetica', label.startsWith('Closing') ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(sanitizePdfText(label), margin + 3, y);
    doc.setFont('courier', 'bold');
    doc.setTextColor(...color);
    doc.text(sanitizePdfText(val), pageWidth - margin - 3, y, { align: 'right' });
    y += 6.5;
  }

  y += 3;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Note: Loans taken are tracked separately and are not included in the balance above.', margin, y);
  y += 7;

  // --- By-programme table (only when all programmes are selected) ---
  if (programFilter === 'all' && programs.length > 0) {
    drawSectionHeading('By Programme');

    const cols = [
      { label: 'Programme', x: margin, w: 58, align: 'left' as const },
      { label: 'Status', x: margin + 60, w: 18, align: 'left' as const },
      { label: 'Income', x: margin + 106, w: 26, align: 'right' as const },
      { label: 'Expenses', x: margin + 134, w: 26, align: 'right' as const },
      { label: 'Net', x: margin + 162, w: 26, align: 'right' as const },
      { label: 'Loans Pending', x: pageWidth - margin, w: 26, align: 'right' as const },
    ];

    const drawProgHeader = () => {
      doc.setFillColor(...TINT);
      doc.rect(margin, y - 3.8, contentWidth, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      cols.forEach((c) => doc.text(c.label, c.x, y, { align: c.align }));
      y += 5;
    };

    drawProgHeader();

    const progRows = programs.map((p) => {
      const pEntries = entries.filter((e) => e.programId === p.id);
      const inc = pEntries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const exp = pEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
      const pendingLoans = loans
        .filter((l) => l.programId === p.id)
        .reduce((s, l) => s + getLoanPendingTotal(l), 0);
      return {
        name: sanitizePdfText(p.name),
        status: p.status === 'open' ? 'Open' : 'Closed',
        inc,
        exp,
        net: inc - exp,
        pendingLoans,
      };
    });

    const generalEntries = entries.filter((e) => !e.programId);
    const generalLoansPending = loans
      .filter((l) => !l.programId)
      .reduce((s, l) => s + getLoanPendingTotal(l), 0);
    if (generalEntries.length > 0 || generalLoansPending > 0) {
      const gInc = generalEntries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const gExp = generalEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
      progRows.push({
        name: 'General (no programme)',
        status: '-',
        inc: gInc,
        exp: gExp,
        net: gInc - gExp,
        pendingLoans: generalLoansPending,
      });
    }

    for (const row of progRows) {
      if (ensureSpace(7)) {
        drawProgHeader();
      }
      const nameLines = doc.splitTextToSize(row.name, 56);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(nameLines[0], cols[0].x, y);
      doc.text(row.status, cols[1].x, y);
      doc.setFont('courier', 'normal');
      doc.setTextColor(...GREEN);
      doc.text(formatINRPdf(row.inc), cols[2].x, y, { align: 'right' });
      doc.setTextColor(...EXPENSE);
      doc.text(formatINRPdf(row.exp), cols[3].x, y, { align: 'right' });
      doc.setTextColor(...(row.net >= 0 ? GREEN : EXPENSE));
      doc.text(formatINRPdf(row.net, true), cols[4].x, y, { align: 'right' });
      doc.setTextColor(...INK);
      doc.text(formatINRPdf(row.pendingLoans), cols[5].x, y, { align: 'right' });
      y += 5.2;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.15);
      doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
    }
    y += 5;
  }

  // --- Expenses by category ---
  const expenseEntries = entries.filter((e) => e.type === 'expense');
  if (expenseEntries.length > 0) {
    drawSectionHeading('Expenses by Category');

    const catMap = new Map<string, { count: number; total: number }>();
    for (const e of expenseEntries) {
      const prev = catMap.get(e.category) || { count: 0, total: 0 };
      catMap.set(e.category, { count: prev.count + 1, total: prev.total + e.amount });
    }
    const catRows = Array.from(catMap.entries()).sort((a, b) => b[1].total - a[1].total);

    const drawCatHeader = () => {
      doc.setFillColor(...TINT);
      doc.rect(margin, y - 3.8, contentWidth, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text('Category', margin + 1, y);
      doc.text('Entries', margin + 100, y, { align: 'right' });
      doc.text('Share', margin + 132, y, { align: 'right' });
      doc.text('Amount', pageWidth - margin - 1, y, { align: 'right' });
      y += 5;
    };

    drawCatHeader();

    for (const [cat, stats] of catRows) {
      if (ensureSpace(6)) drawCatHeader();
      const pct = totalExpenses > 0 ? ((stats.total / totalExpenses) * 100).toFixed(1) : '0.0';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(sanitizePdfText(cat), margin + 1, y);
      doc.setFont('courier', 'normal');
      doc.text(String(stats.count), margin + 100, y, { align: 'right' });
      doc.text(`${pct}%`, margin + 132, y, { align: 'right' });
      doc.setTextColor(...EXPENSE);
      doc.text(formatINRPdf(stats.total), pageWidth - margin - 1, y, { align: 'right' });
      y += 5.2;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.15);
      doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
    }
    y += 5;
  }

  // --- Loans taken table ---
  const scopedLoans = loans.filter((l) => {
    if (programFilter === 'all') return true;
    if (programFilter === 'none') return !l.programId;
    return l.programId === programFilter;
  });

  drawSectionHeading('Loans Taken');

  if (scopedLoans.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text('No loans recorded for the selected scope.', margin, y);
    y += 7;
  } else {
    const drawLoanHeader = () => {
      doc.setFillColor(...TINT);
      doc.rect(margin, y - 3.8, contentWidth, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text('Lender', margin + 1, y);
      doc.text('Programme', margin + 45, y);
      doc.text('Date', margin + 88, y);
      doc.text('Amount', margin + 128, y, { align: 'right' });
      doc.text('Repaid', margin + 155, y, { align: 'right' });
      doc.text('Pending', pageWidth - margin - 1, y, { align: 'right' });
      y += 5;
    };

    drawLoanHeader();

    let sumBorrowed = 0;
    let sumRepaid = 0;
    let sumPending = 0;

    for (const loan of scopedLoans) {
      if (ensureSpace(7)) drawLoanHeader();
      const repaid = getLoanRepaidTotal(loan);
      const pending = getLoanPendingTotal(loan);
      sumBorrowed += loan.amount;
      sumRepaid += repaid;
      sumPending += pending;

      const lenderLabel = sanitizePdfText(
        loan.source === 'committee' ? `${loan.name} (Committee)` : loan.name
      );
      const progName = loan.programId
        ? sanitizePdfText(programsMap.get(loan.programId)?.name || '-')
        : 'General';

      const lenderLine = doc.splitTextToSize(lenderLabel, 42)[0];
      const progLine = doc.splitTextToSize(progName, 40)[0];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(lenderLine, margin + 1, y);
      doc.text(progLine, margin + 45, y);
      doc.setFont('courier', 'normal');
      doc.text(loan.date, margin + 88, y);
      doc.text(formatINRPdf(loan.amount), margin + 128, y, { align: 'right' });
      doc.setTextColor(...GREEN);
      doc.text(formatINRPdf(repaid), margin + 155, y, { align: 'right' });
      doc.setTextColor(...(pending > 0 ? EXPENSE : MUTED));
      doc.text(formatINRPdf(pending), pageWidth - margin - 1, y, { align: 'right' });
      y += 5.2;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.15);
      doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
    }

    ensureSpace(8);
    doc.setFillColor(...TINT);
    doc.rect(margin, y - 3.6, contentWidth, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...INK);
    doc.text('Totals', margin + 1, y);
    doc.setFont('courier', 'bold');
    doc.text(formatINRPdf(sumBorrowed), margin + 128, y, { align: 'right' });
    doc.setTextColor(...GREEN);
    doc.text(formatINRPdf(sumRepaid), margin + 155, y, { align: 'right' });
    doc.setTextColor(...(sumPending > 0 ? EXPENSE : INK));
    doc.text(formatINRPdf(sumPending), pageWidth - margin - 1, y, { align: 'right' });
    y += 8;
  }

  // --- Full Entries Table (repeats header on each page) ---
  drawSectionHeading(`All Entries (${entries.length})`);

  const drawEntriesHeader = () => {
    doc.setFillColor(...INK);
    doc.rect(margin, y - 3.8, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(255, 255, 255);
    doc.text('Date', margin + 1.5, y);
    doc.text('Type', margin + 22, y);
    doc.text('Category', margin + 37, y);
    doc.text('Programme', margin + 68, y);
    doc.text('Description', margin + 100, y);
    doc.text('By', margin + 144, y);
    doc.text('Amount', pageWidth - margin - 1.5, y, { align: 'right' });
    y += 5.8;
  };

  drawEntriesHeader();

  for (const entry of entries) {
    const progName = entry.programId
      ? sanitizePdfText(programsMap.get(entry.programId)?.name || '-')
      : 'General';
    const lateTag = isLateEntry(entry, programsMap) ? ' [LATE]' : '';
    const descRaw = sanitizePdfText((entry.note || '-') + lateTag);
    const byRaw = sanitizePdfText(userNames[entry.addedBy] || 'Unknown');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const descLines = doc.splitTextToSize(descRaw, 42);
    const progLines = doc.splitTextToSize(progName, 30);
    const catLines = doc.splitTextToSize(sanitizePdfText(entry.category), 29);
    const byLines = doc.splitTextToSize(byRaw, 18);

    const maxLines = Math.max(descLines.length, progLines.length, catLines.length, byLines.length, 1);
    const rowHeight = maxLines * 3.6 + 2.4;

    if (ensureSpace(rowHeight + 2)) {
      drawEntriesHeader();
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(entry.date, margin + 1.5, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(entry.type === 'income' ? GREEN : EXPENSE));
    doc.text(entry.type === 'income' ? 'INC' : 'EXP', margin + 22, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(catLines, margin + 37, y);
    doc.text(progLines, margin + 68, y);
    doc.text(descLines, margin + 100, y);
    doc.setTextColor(...MUTED);
    doc.text(byLines, margin + 144, y);

    doc.setFont('courier', 'bold');
    doc.setTextColor(...(entry.type === 'income' ? GREEN : EXPENSE));
    const amtText = formatINRPdf(entry.type === 'income' ? entry.amount : -entry.amount, true);
    doc.text(amtText, pageWidth - margin - 1.5, y, { align: 'right' });

    y += rowHeight;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.12);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
  }

  // --- Footer on every page: Page X of Y ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(sanitizePdfText(org.orgName || 'SSF VNR Unit Finance'), margin, pageHeight - 8.5);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 8.5, {
      align: 'right',
    });
  }

  const slug =
    sanitizePdfText(org.orgName || 'ssf-vnr-finance')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'ssf-vnr-finance';
  const periodSlug = monthFilter === 'all' ? 'all-months' : monthFilter;
  doc.save(`${slug}-report-${periodSlug}.pdf`);
  return true;
}
