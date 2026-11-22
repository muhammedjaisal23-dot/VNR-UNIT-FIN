import type { AppStatePayload, DatabaseSnapshot } from '../types';

const LS_BACKUP_KEY = 'ssf-vnr-finance-backup-v1';
const IDB_NAME = 'ssf-vnr-unit-finance-store';
const IDB_STORE = 'backups';
const IDB_KEY = 'admin-latest';

export function buildSnapshotFromState(state: AppStatePayload): DatabaseSnapshot {
  return {
    version: 1,
    savedAt: Date.now(),
    revision: Math.max(1, Number(state.revision) || 1),
    org: {
      orgName: state.org.orgName,
      openingBalance: state.org.openingBalance,
      publicViewEnabled: state.org.publicViewEnabled !== false,
    },
    programs: Array.isArray(state.programs) ? state.programs : [],
    income: Array.isArray(state.income) ? state.income : [],
    expenses: Array.isArray(state.expenses) ? state.expenses : [],
    loans: Array.isArray(state.loans) ? state.loans : [],
    committee: Array.isArray(state.committee) ? state.committee : [],
    customCategories: {
      expense: Array.isArray(state.customCategories?.expense)
        ? state.customCategories.expense
        : [],
      income: Array.isArray(state.customCategories?.income)
        ? state.customCategories.income
        : [],
    },
    users: Array.isArray(state.users) ? state.users : [],
  };
}

export function hasMeaningfulData(snapshot: DatabaseSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return (
    snapshot.programs.length > 0 ||
    snapshot.income.length > 0 ||
    snapshot.expenses.length > 0 ||
    snapshot.loans.length > 0 ||
    snapshot.committee.length > 0 ||
    (snapshot.customCategories?.expense?.length || 0) > 0 ||
    (snapshot.customCategories?.income?.length || 0) > 0 ||
    snapshot.org.openingBalance !== 0 ||
    (snapshot.org.orgName.trim() !== '' && snapshot.org.orgName.trim() !== 'SSF VNR Unit') ||
    (snapshot.users?.length || 0) > 1
  );
}

function openBackupDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) {
          idb.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeIdbSnapshot(snapshot: DatabaseSnapshot): Promise<void> {
  const idb = await openBackupDb();
  if (!idb) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(snapshot, IDB_KEY);
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        resolve();
      };
    } catch {
      idb.close();
      resolve();
    }
  });
}

async function readIdbSnapshot(): Promise<DatabaseSnapshot | null> {
  const idb = await openBackupDb();
  if (!idb) return null;
  return new Promise<DatabaseSnapshot | null>((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        idb.close();
        const val = req.result;
        resolve(val && typeof val === 'object' ? (val as DatabaseSnapshot) : null);
      };
      req.onerror = () => {
        idb.close();
        resolve(null);
      };
    } catch {
      idb.close();
      resolve(null);
    }
  });
}

function readLocalStorageSnapshot(): DatabaseSnapshot | null {
  try {
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.org) return null;
    return parsed as DatabaseSnapshot;
  } catch {
    return null;
  }
}

export async function saveLocalBackup(state: AppStatePayload): Promise<void> {
  if (state.currentUser.role !== 'admin') return;
  const snapshot = buildSnapshotFromState(state);

  try {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors in restricted contexts; IndexedDB still backs it up
  }

  await writeIdbSnapshot(snapshot);
}

export async function loadLocalBackup(): Promise<DatabaseSnapshot | null> {
  const ls = readLocalStorageSnapshot();
  const idb = await readIdbSnapshot();

  if (ls && idb) {
    if ((idb.savedAt || 0) > (ls.savedAt || 0)) return idb;
    return ls;
  }
  return ls || idb || null;
}

export function downloadBackupFile(state: AppStatePayload): void {
  const snapshot = buildSnapshotFromState(state);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const slug =
    state.org.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'ssf-vnr-unit';
  const today = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}-backup-${today}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseBackupFile(rawText: string): DatabaseSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file format.');
  }

  const obj = parsed as Record<string, unknown>;
  const org = obj.org as Record<string, unknown> | undefined;
  if (!org || typeof org.orgName !== 'string') {
    throw new Error('Backup file is missing organisation details.');
  }

  return {
    version: 1,
    savedAt: typeof obj.savedAt === 'number' ? obj.savedAt : Date.now(),
    revision: typeof obj.revision === 'number' && obj.revision > 0 ? obj.revision : 1,
    org: {
      orgName: org.orgName.trim() || 'SSF VNR Unit',
      openingBalance: Number.isFinite(Number(org.openingBalance)) ? Number(org.openingBalance) : 0,
      publicViewEnabled:
        typeof org.publicViewEnabled === 'boolean' ? org.publicViewEnabled : true,
    },
    programs: Array.isArray(obj.programs) ? (obj.programs as DatabaseSnapshot['programs']) : [],
    income: Array.isArray(obj.income) ? (obj.income as DatabaseSnapshot['income']) : [],
    expenses: Array.isArray(obj.expenses) ? (obj.expenses as DatabaseSnapshot['expenses']) : [],
    loans: Array.isArray(obj.loans) ? (obj.loans as DatabaseSnapshot['loans']) : [],
    committee: Array.isArray(obj.committee) ? (obj.committee as DatabaseSnapshot['committee']) : [],
    customCategories: {
      expense: Array.isArray((obj.customCategories as Record<string, unknown> | undefined)?.expense)
        ? ((obj.customCategories as Record<string, unknown>).expense as string[])
        : [],
      income: Array.isArray((obj.customCategories as Record<string, unknown> | undefined)?.income)
        ? ((obj.customCategories as Record<string, unknown>).income as string[])
        : [],
    },
    users: Array.isArray(obj.users) ? (obj.users as DatabaseSnapshot['users']) : [],
  };
}
