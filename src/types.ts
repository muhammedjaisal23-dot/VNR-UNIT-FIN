export type UserRole = 'admin' | 'secretary' | 'viewer';

export const EXPENSE_CATEGORIES = [
  'Programme expense',
  'Rent',
  'Travel',
  'Food',
  'Printing / notices',
  'Relief aid',
  'Other',
] as const;

export const INCOME_CATEGORIES = [
  'Membership fee',
  'Donation',
  'Programme collection',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export interface CustomCategories {
  expense: string[];
  income: string[];
}

/**
 * Builds the dropdown category list: built-in categories (excluding "Other"),
 * followed by saved custom categories, with "Other" always at the bottom.
 */
export function getCategoryOptions(
  type: 'income' | 'expense',
  customList: string[] = [],
  extraCategory?: string
): string[] {
  const defaults = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const base = defaults.filter((c) => c !== 'Other') as string[];
  const seen = new Set(base.map((c) => c.toLowerCase()));
  const result = [...base];

  const appendUnique = (val?: string) => {
    if (!val) return;
    const cleaned = val.trim().replace(/\s+/g, ' ');
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    if (lower === 'other' || seen.has(lower)) return;
    seen.add(lower);
    result.push(cleaned);
  };

  for (const item of customList) appendUnique(item);
  appendUnique(extraCategory);
  result.push('Other');
  return result;
}

export interface OrgMeta {
  orgName: string;
  openingBalance: number;
  publicViewEnabled?: boolean;
}

export interface Program {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  status: 'open' | 'closed';
  createdAt: number;
  closedAt: number | null;
}

export interface EntryRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  note: string;
  programId: string | null;
  addedBy: string; // userId only, never display name
  timestamp: number;
}

export interface LedgerItem extends EntryRecord {
  type: 'income' | 'expense';
}

export interface LoanRepayment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  ts: number;
}

export interface Loan {
  id: string;
  name: string;
  source: 'committee' | 'outside';
  amount: number;
  date: string; // YYYY-MM-DD
  programId: string | null;
  note: string;
  addedBy: string; // userId only
  timestamp: number;
  repayments: LoanRepayment[];
}

export interface CommitteeMember {
  id: string;
  name: string;
  ts: number;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AdminAuthInfo {
  username: string;
  envConfigured: boolean;
}

export interface AuthStatusPayload {
  adminConfigured: boolean;
  envConfigured: boolean;
  publicViewEnabled: boolean;
  orgName: string;
  authenticated: boolean;
  state?: AppStatePayload;
}

export interface AppStatePayload {
  revision: number;
  currentUser: AuthUser;
  org: OrgMeta;
  programs: Program[];
  income: EntryRecord[];
  expenses: EntryRecord[];
  customCategories?: CustomCategories;
  userNames: Record<string, string>;
  // Admin-only collections (omitted by server for non-admin roles)
  loans?: Loan[];
  committee?: CommitteeMember[];
  users?: ManagedUser[];
  adminAuth?: AdminAuthInfo;
}

export interface DatabaseSnapshot {
  version: 1;
  savedAt: number;
  revision: number;
  org: OrgMeta;
  programs: Program[];
  income: EntryRecord[];
  expenses: EntryRecord[];
  loans: Loan[];
  committee: CommitteeMember[];
  customCategories: CustomCategories;
  users?: ManagedUser[];
}

export interface PublicStatePayload {
  enabled: boolean;
  orgName?: string;
  revision?: number;
  org?: OrgMeta;
  programs?: Program[];
  income?: EntryRecord[];
  expenses?: EntryRecord[];
  userNames?: Record<string, string>;
}
