import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import type {
  AppStatePayload,
  AuthStatusPayload,
  DatabaseSnapshot,
  LedgerItem,
  Program,
  PublicStatePayload,
} from './types';
import {
  addCommitteeMember,
  addCustomCategory,
  addLoanRepayment,
  createEntry,
  createLoan,
  createProgram,
  deleteCommitteeMember,
  deleteCustomCategory,
  deleteEntry,
  deleteLoan,
  deleteProgram,
  fetchAuthStatus,
  fetchPublicState,
  inviteUser,
  loginAdmin,
  loginByEmail,
  logoutSession,
  removeInvitedUser,
  restoreDatabaseSnapshot,
  setPublicViewEnabled,
  setupAdminCredentials,
  subscribeToUpdates,
  updateAdminCredentials,
  updateEntry,
  updateOrg,
  updateProgramStatus,
} from './services/api';
import {
  exportLedgerCsv,
  formatINR,
  formatMonthLabel,
  getCurrentMonthKey,
  getLoanPendingTotal,
} from './utils/format';
import {
  downloadBackupFile,
  hasMeaningfulData,
  loadLocalBackup,
  saveLocalBackup,
} from './utils/localBackup';
import { generateFinancePdfReport, isJsPdfReady } from './utils/pdfReport';
import { TopBar } from './components/TopBar';
import { Sidebar, type AdminSection } from './components/Sidebar';
import { HomeSection } from './components/HomeSection';
import { EntryForm } from './components/EntryForm';
import { LedgerSection } from './components/LedgerSection';
import { AnalyticsSection } from './components/AnalyticsSection';
import { ProgramsSection } from './components/ProgramsSection';
import { LoansSection } from './components/LoansSection';
import { SettingsSection } from './components/SettingsSection';
import { AccountModal } from './components/AccountModal';
import { SecretaryView } from './components/SecretaryView';
import { ViewOnlyView } from './components/ViewOnlyView';
import { PublicView } from './components/PublicView';
import { AdminAuthScreen } from './components/AdminAuthScreen';

function parseProgramHash(hash: string): string | null {
  const match = hash.match(/^#p-([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : null;
}

function isPublicHashValue(hash: string): boolean {
  return hash.trim().toLowerCase() === '#public';
}

export default function App() {
  const [state, setState] = useState<AppStatePayload | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusPayload | null>(null);
  const [publicState, setPublicState] = useState<PublicStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  const [activeSection, setActiveSection] = useState<AdminSection>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  // Filters
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Hash routing (#p-<programmeId> or #public)
  const [hashProgramId, setHashProgramId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? parseProgramHash(window.location.hash) : null
  );
  const [isPublicView, setIsPublicView] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isPublicHashValue(window.location.hash) : false
  );

  // jsPDF readiness check (loaded via deferred cdnjs script)
  const [pdfAvailable, setPdfAvailable] = useState<boolean>(() => isJsPdfReady());

  useEffect(() => {
    if (pdfAvailable) return;
    let checks = 0;
    const interval = setInterval(() => {
      checks += 1;
      if (isJsPdfReady()) {
        setPdfAvailable(true);
        clearInterval(interval);
      } else if (checks >= 20) {
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [pdfAvailable]);

  useEffect(() => {
    const onHashChange = () => {
      const pub = isPublicHashValue(window.location.hash);
      setIsPublicView(pub);
      const parsed = parseProgramHash(window.location.hash);
      setHashProgramId(parsed);
      if (parsed && !pub) {
        setProgramFilter(parsed);
        setActiveSection('ledger');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Apply initial hash filter for admin
  useEffect(() => {
    if (hashProgramId && state?.currentUser.role === 'admin') {
      if (state.programs.some((p) => p.id === hashProgramId)) {
        setProgramFilter(hashProgramId);
        setActiveSection('ledger');
      }
    }
  }, [hashProgramId, state?.currentUser.role, state?.programs]);

  const applyState = useCallback((next: AppStatePayload) => {
    setState(next);
    if (next.currentUser.role === 'admin') {
      void saveLocalBackup(next);
    }
  }, []);

  const finalizeAuthenticatedState = useCallback(async (incoming: AppStatePayload) => {
    let next = incoming;
    // If the server container restarted with a fresh empty store (revision === 0),
    // automatically re-hydrate it from this admin browser's persistent local backup.
    if (next.currentUser.role === 'admin' && (next.revision || 0) === 0) {
      const backup = await loadLocalBackup();
      if (backup && hasMeaningfulData(backup)) {
        try {
          const restored = await restoreDatabaseSnapshot('auto', backup);
          next = restored.state;
        } catch {
          // Keep fetched state if restore call fails
        }
      }
    }
    setState(next);
    setAuthStatus((prev) => ({
      adminConfigured: true,
      envConfigured: next.adminAuth?.envConfigured ?? prev?.envConfigured ?? false,
      publicViewEnabled: next.org.publicViewEnabled !== false,
      orgName: next.org.orgName,
      authenticated: true,
      state: next,
    }));
    if (next.currentUser.role === 'admin' && (next.revision || 0) > 0) {
      void saveLocalBackup(next);
    }
    try {
      const pub = await fetchPublicState(8000);
      setPublicState(pub);
    } catch {
      // ignore secondary public refresh error
    }
  }, []);

  const loadAppState = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setLoadFailed(null);
    }

    let timedOut = false;
    const timeoutId = isInitial
      ? setTimeout(() => {
          timedOut = true;
          setLoading(false);
          setLoadFailed(
            'Loading took longer than 10 seconds. Please check your connection and try again.'
          );
        }, 10000)
      : null;

    try {
      const status = await fetchAuthStatus(10000);
      const wantsPublic =
        typeof window !== 'undefined' && isPublicHashValue(window.location.hash);

      let nextState = status.authenticated && status.state ? status.state : null;
      if (nextState && nextState.currentUser.role === 'admin' && (nextState.revision || 0) === 0) {
        const backup = await loadLocalBackup();
        if (backup && hasMeaningfulData(backup)) {
          try {
            const restored = await restoreDatabaseSnapshot('auto', backup);
            nextState = restored.state;
          } catch {
            // Keep fetched state if restore call fails
          }
        }
      }

      let pub: PublicStatePayload | null = null;
      if (wantsPublic || nextState) {
        try {
          pub = await fetchPublicState(8000);
        } catch {
          // ignore secondary public refresh error unless viewing #public directly
          if (wantsPublic && !nextState) {
            throw new Error('Could not load public finance report.');
          }
        }
      }

      if (timeoutId) clearTimeout(timeoutId);
      if (!timedOut) {
        setAuthStatus(status);
        setState(nextState);
        if (pub) setPublicState(pub);
        if (nextState && nextState.currentUser.role === 'admin' && (nextState.revision || 0) > 0) {
          void saveLocalBackup(nextState);
        }
        setLoadFailed(null);
        setLoading(false);
      }
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (isInitial) {
        setLoading(false);
        setLoadFailed(
          err instanceof Error
            ? err.message
            : 'Could not load finance data. Please try again.'
        );
      }
    }
  }, []);

  useEffect(() => {
    loadAppState(true);
  }, [loadAppState]);

  // Live SSE sync across users/tabs
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      loadAppState(false);
    });
    return unsubscribe;
  }, [loadAppState]);

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('ssf-vnr-theme', next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  };

  // --- Derived Data ---
  const programs = state?.programs || [];
  const income = state?.income || [];
  const expenses = state?.expenses || [];
  const loans = state?.loans || [];
  const committee = state?.committee || [];
  const userNames = state?.userNames || {};
  const customExpenseCategories = state?.customCategories?.expense || [];
  const customIncomeCategories = state?.customCategories?.income || [];

  const programsMap = useMemo(() => {
    const map = new Map<string, Program>();
    for (const p of programs) map.set(p.id, p);
    return map;
  }, [programs]);

  const openPrograms = useMemo(
    () => programs.filter((p) => p.status === 'open'),
    [programs]
  );

  // Combined newest-first ledger
  const allLedgerEntries: LedgerItem[] = useMemo(() => {
    const combined: LedgerItem[] = [
      ...income.map((i) => ({ ...i, type: 'income' as const })),
      ...expenses.map((e) => ({ ...e, type: 'expense' as const })),
    ];
    combined.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.timestamp - a.timestamp;
    });
    return combined;
  }, [income, expenses]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([getCurrentMonthKey()]);
    for (const entry of allLedgerEntries) {
      if (entry.date && entry.date.length >= 7) {
        set.add(entry.date.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allLedgerEntries]);

  const monthAndProgramEntries = useMemo(() => {
    return allLedgerEntries.filter((entry) => {
      if (monthFilter !== 'all' && !entry.date.startsWith(monthFilter)) return false;
      if (programFilter === 'none' && entry.programId) return false;
      if (programFilter !== 'all' && programFilter !== 'none' && entry.programId !== programFilter) {
        return false;
      }
      return true;
    });
  }, [allLedgerEntries, monthFilter, programFilter]);

  const visibleLedgerEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthAndProgramEntries.filter((entry) => {
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      if (!q) return true;
      const progName = entry.programId ? programsMap.get(entry.programId)?.name || '' : 'general';
      const haystack = [
        entry.note,
        entry.category,
        String(entry.amount),
        formatINR(entry.amount),
        progName,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [monthAndProgramEntries, typeFilter, searchQuery, programsMap]);

  const scopedIncomeForSixMonths = useMemo(() => {
    return income.filter((i) => {
      if (programFilter === 'none') return !i.programId;
      if (programFilter !== 'all') return i.programId === programFilter;
      return true;
    });
  }, [income, programFilter]);

  const scopedExpensesForSixMonths = useMemo(() => {
    return expenses.filter((e) => {
      if (programFilter === 'none') return !e.programId;
      if (programFilter !== 'all') return e.programId === programFilter;
      return true;
    });
  }, [expenses, programFilter]);

  const allTimeIncome = useMemo(() => income.reduce((s, i) => s + i.amount, 0), [income]);
  const allTimeExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const currentBalance = (state?.org.openingBalance || 0) + allTimeIncome - allTimeExpenses;

  const totalLoansStillToRepay = useMemo(
    () => loans.reduce((s, l) => s + getLoanPendingTotal(l), 0),
    [loans]
  );

  const filteredIncomeTotal = useMemo(
    () =>
      monthAndProgramEntries
        .filter((e) => e.type === 'income')
        .reduce((s, e) => s + e.amount, 0),
    [monthAndProgramEntries]
  );

  const filteredExpensesTotal = useMemo(
    () =>
      monthAndProgramEntries
        .filter((e) => e.type === 'expense')
        .reduce((s, e) => s + e.amount, 0),
    [monthAndProgramEntries]
  );

  const filteredExpensesList = useMemo(
    () => monthAndProgramEntries.filter((e) => e.type === 'expense'),
    [monthAndProgramEntries]
  );

  const activeScopeLabel = useMemo(() => {
    const mLabel = formatMonthLabel(monthFilter);
    const pLabel =
      programFilter === 'all'
        ? 'All programmes'
        : programFilter === 'none'
          ? 'General'
          : programsMap.get(programFilter)?.name || 'Selected programme';
    return `${mLabel} · ${pLabel}`;
  }, [monthFilter, programFilter, programsMap]);

  // --- Handlers ---
  const handleAdminSetup = async (username: string, password: string) => {
    const next = await setupAdminCredentials(username, password);
    await finalizeAuthenticatedState(next);
  };

  const handleAdminLogin = async (username: string, password: string) => {
    const next = await loginAdmin(username, password);
    await finalizeAuthenticatedState(next);
  };

  const handleUpdateAdminCredentials = async (payload: {
    currentPassword: string;
    username: string;
    newPassword?: string;
  }) => {
    const next = await updateAdminCredentials(payload);
    applyState(next);
  };

  const handleLogout = async () => {
    await logoutSession();
    setState(null);
    setAccountModalOpen(false);
    setActiveSection('home');
    try {
      const status = await fetchAuthStatus(8000);
      setAuthStatus(status);
    } catch {
      // ignore
    }
  };

  const handleSwitchAccount = async (email: string, name?: string) => {
    const next = await loginByEmail(email, name);
    await finalizeAuthenticatedState(next);
  };

  const handleInviteUser = async (payload: {
    email: string;
    name: string;
    role: 'secretary' | 'viewer';
  }) => {
    const next = await inviteUser(payload);
    applyState(next);
  };

  const handleRemoveUser = async (id: string) => {
    const next = await removeInvitedUser(id);
    applyState(next);
  };

  const handleCreateEntry = async (
    type: 'income' | 'expense',
    payload: {
      date: string;
      amount: number;
      category: string;
      note: string;
      programId: string | null;
    }
  ) => {
    const next = await createEntry(type, payload);
    applyState(next);
  };

  const handleUpdateEntry = async (
    type: 'income' | 'expense',
    id: string,
    payload: {
      date: string;
      amount: number;
      category: string;
      note: string;
      programId: string | null;
    }
  ) => {
    const next = await updateEntry(type, id, payload);
    applyState(next);
  };

  const handleDeleteEntry = async (type: 'income' | 'expense', id: string) => {
    const next = await deleteEntry(type, id);
    applyState(next);
  };

  const handleCreateProgram = async (payload: { name: string; date: string }) => {
    const next = await createProgram(payload);
    applyState(next);
  };

  const handleUpdateProgramStatus = async (id: string, status: 'open' | 'closed') => {
    const next = await updateProgramStatus(id, status);
    applyState(next);
  };

  const handleDeleteProgram = async (id: string) => {
    const next = await deleteProgram(id);
    applyState(next);
    setProgramFilter((curr) => (curr === id ? 'all' : curr));
  };

  const handleCreateLoan = async (payload: {
    name: string;
    source: 'committee' | 'outside';
    amount: number;
    date: string;
    programId: string | null;
    note: string;
  }) => {
    const next = await createLoan(payload);
    applyState(next);
  };

  const handleAddRepayment = async (
    loanId: string,
    payload: { amount: number; date: string }
  ) => {
    const next = await addLoanRepayment(loanId, payload);
    applyState(next);
  };

  const handleDeleteLoan = async (loanId: string) => {
    const next = await deleteLoan(loanId);
    applyState(next);
  };

  const handleSaveOrg = async (payload: { orgName: string; openingBalance: number }) => {
    const next = await updateOrg(payload);
    applyState(next);
  };

  const handleAddCommitteeMember = async (name: string) => {
    const next = await addCommitteeMember(name);
    applyState(next);
  };

  const handleDeleteCommitteeMember = async (id: string) => {
    const next = await deleteCommitteeMember(id);
    applyState(next);
  };

  const handleAddCustomCategory = async (
    type: 'income' | 'expense',
    name: string
  ): Promise<string> => {
    const res = await addCustomCategory(type, name);
    applyState(res.state);
    return res.category;
  };

  const handleDeleteCustomCategory = async (type: 'income' | 'expense', name: string) => {
    const next = await deleteCustomCategory(type, name);
    applyState(next);
  };

  const handleDownloadBackup = () => {
    if (!state) return;
    downloadBackupFile(state);
  };

  const handleRestoreBackup = async (snapshot: DatabaseSnapshot) => {
    const res = await restoreDatabaseSnapshot('manual', snapshot);
    applyState(res.state);
  };

  const handleTogglePublicView = async (enabled: boolean) => {
    const next = await setPublicViewEnabled(enabled);
    applyState(next);
    try {
      const pub = await fetchPublicState(8000);
      setPublicState(pub);
    } catch {
      // ignore
    }
  };

  const handleOpenPublicView = () => {
    setIsPublicView(true);
    if (typeof window !== 'undefined' && window.location.hash !== '#public') {
      window.location.hash = '#public';
    }
    void fetchPublicState(8000)
      .then((pub) => setPublicState(pub))
      .catch(() => {});
  };

  const handleExitPublicView = () => {
    setIsPublicView(false);
    if (typeof window !== 'undefined' && isPublicHashValue(window.location.hash)) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  const handleExportCsv = () => {
    if (!state) return;
    exportLedgerCsv({
      orgName: state.org.orgName,
      entries: visibleLedgerEntries,
      programsMap,
      userNames,
      monthFilter,
      programFilter,
    });
  };

  const handleExportPdf = () => {
    if (!state) return;
    generateFinancePdfReport({
      org: state.org,
      monthFilter,
      programFilter,
      programs,
      programsMap,
      entries: monthAndProgramEntries,
      loans,
      userNames,
    });
  };

  // --- Initial Loading / 10-second Failure States ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f6f3] dark:bg-[#121212]">
        <div className="w-full max-w-md rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-6 text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#ff4f00] dark:border-[#ffc400] border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff]">
            Loading SSF VNR Unit Finance...
          </p>
          <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8]">
            Syncing shared unit accounts
          </p>
        </div>
      </div>
    );
  }

  if (loadFailed || (!authStatus && !state && !(isPublicView && publicState))) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f6f3] dark:bg-[#121212]">
        <div className="w-full max-w-md rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-6 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-[#dc2626] dark:text-[#f87171] mx-auto" />
          <div>
            <h1 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
              Could not load accounts
            </h1>
            <p className="text-sm text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              {loadFailed || 'Unable to reach the shared finance database.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadAppState(true)}
            className="min-h-[44px] px-5 inline-flex items-center gap-2 rounded-lg text-sm font-semibold cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const currentUser = state?.currentUser || null;
  const org = state?.org ||
    publicState?.org || {
      orgName: publicState?.orgName || authStatus?.orgName || 'SSF VNR Unit',
      openingBalance: 0,
      publicViewEnabled: publicState?.enabled ?? authStatus?.publicViewEnabled ?? true,
    };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f6f3] text-[#1c1c1c] dark:bg-[#121212] dark:text-[#ffffff]">
      <TopBar
        orgName={org.orgName}
        currentUser={currentUser}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        menuOpen={sidebarOpen}
        onToggleMenu={() => setSidebarOpen((prev) => !prev)}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
        onOpenAccount={() => setAccountModalOpen(true)}
        isPublicView={isPublicView}
        onExitPublicView={handleExitPublicView}
        onOpenAdminSignIn={handleExitPublicView}
      />

      {/* Public View OR Admin Auth Screen OR Role-based View */}
      {isPublicView ? (
        <PublicView
          publicState={
            publicState || {
              enabled: org.publicViewEnabled !== false,
              orgName: org.orgName,
              org,
              programs,
              income,
              expenses,
              userNames,
            }
          }
          isAdmin={currentUser?.role === 'admin'}
          onExitPublicView={handleExitPublicView}
          onEnablePublicView={() => handleTogglePublicView(true)}
        />
      ) : !currentUser ? (
        <AdminAuthScreen
          orgName={org.orgName}
          adminConfigured={authStatus?.adminConfigured ?? false}
          initialTab={hashProgramId ? 'email' : 'admin'}
          onSetupAdmin={handleAdminSetup}
          onLoginAdmin={handleAdminLogin}
          onLoginEmail={handleSwitchAccount}
        />
      ) : currentUser.role === 'viewer' ? (
        <ViewOnlyView
          orgName={org.orgName}
          currentUser={currentUser}
          publicViewEnabled={org.publicViewEnabled !== false}
          onOpenPublicView={handleOpenPublicView}
          onOpenAccount={() => setAccountModalOpen(true)}
        />
      ) : currentUser.role === 'secretary' ? (
        <SecretaryView
          programIdFromLink={hashProgramId}
          program={hashProgramId ? programsMap.get(hashProgramId) : undefined}
          expenses={expenses}
          customExpenseCategories={customExpenseCategories}
          onAddCustomCategory={handleAddCustomCategory}
          currentUser={currentUser}
          userNames={userNames}
          onAddExpense={handleCreateEntry}
          onDeleteExpense={(id) => handleDeleteEntry('expense', id)}
        />
      ) : (
        /* Finance Admin View with slide-over side menu (mobile & desktop) */
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Sidebar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            entriesCount={allLedgerEntries.length}
            openProgramsCount={openPrograms.length}
            pendingLoansAmount={totalLoansStillToRepay}
          />

          <main className="w-full min-w-0 space-y-6">
            {activeSection === 'home' && (
              <HomeSection
                org={org}
                currentBalance={currentBalance}
                totalLoansStillToRepay={totalLoansStillToRepay}
                allEntries={allLedgerEntries}
                income={income}
                expenses={expenses}
                programs={programs}
                programsMap={programsMap}
                loans={loans}
                userNames={userNames}
                onNavigate={setActiveSection}
              />
            )}

            {activeSection === 'ledger' && (
              <div className="space-y-6">
                {/* Summary Strip scoped to active Ledger filters */}
                <section aria-label="Account summary" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#ffc9ad] dark:border-[#ff4f00]/50 p-5 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-[#d94300] dark:text-[#ffc400]">
                        Current Balance
                      </div>
                      <div
                        className={`font-num text-2xl sm:text-3xl font-bold mt-1.5 break-all ${
                          currentBalance < 0
                            ? 'text-[#dc2626] dark:text-[#f87171]'
                            : 'text-[#1c1c1c] dark:text-[#ffffff]'
                        }`}
                      >
                        {formatINR(currentBalance)}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#efeae2] dark:border-[#303030] space-y-1 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
                      <div>
                        Opening <span className="font-num">{formatINR(org.openingBalance)}</span> +
                        Income − Expenses
                      </div>
                      <div>
                        Loans still to repay:{' '}
                        <span className="font-num font-semibold text-[#d94300] dark:text-[#ffc400]">
                          {formatINR(totalLoansStillToRepay)}
                        </span>{' '}
                        (not counted in balance)
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-5 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8]">
                        Total Income
                      </div>
                      <div className="font-num text-2xl sm:text-3xl font-bold text-[#15803d] dark:text-[#4ade80] mt-1.5 break-all">
                        {formatINR(filteredIncomeTotal)}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#efeae2] dark:border-[#303030] text-xs text-[#5c5852] dark:text-[#b8b8b8] break-words">
                      {activeScopeLabel}
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-5 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8]">
                        Total Expenses
                      </div>
                      <div className="font-num text-2xl sm:text-3xl font-bold text-[#ff4f00] dark:text-[#ff7a3d] mt-1.5 break-all">
                        {formatINR(filteredExpensesTotal)}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#efeae2] dark:border-[#303030] text-xs text-[#5c5852] dark:text-[#b8b8b8] break-words">
                      {activeScopeLabel}
                    </div>
                  </div>
                </section>

                <EntryForm
                  mode="admin"
                  openPrograms={openPrograms}
                  customExpenseCategories={customExpenseCategories}
                  customIncomeCategories={customIncomeCategories}
                  onAddCustomCategory={handleAddCustomCategory}
                  onSubmit={handleCreateEntry}
                />

                <LedgerSection
                  entries={visibleLedgerEntries}
                  allFilteredForReportCount={monthAndProgramEntries.length}
                  programs={programs}
                  programsMap={programsMap}
                  customExpenseCategories={customExpenseCategories}
                  customIncomeCategories={customIncomeCategories}
                  onAddCustomCategory={handleAddCustomCategory}
                  userNames={userNames}
                  availableMonths={availableMonths}
                  monthFilter={monthFilter}
                  onMonthFilterChange={setMonthFilter}
                  programFilter={programFilter}
                  onProgramFilterChange={setProgramFilter}
                  typeFilter={typeFilter}
                  onTypeFilterChange={setTypeFilter}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  onUpdateEntry={handleUpdateEntry}
                  onDeleteEntry={handleDeleteEntry}
                  onExportCsv={handleExportCsv}
                  onExportPdf={handleExportPdf}
                  showPdfButton={pdfAvailable}
                />

                <AnalyticsSection
                  filteredExpenses={filteredExpensesList}
                  scopedIncomeForSixMonths={scopedIncomeForSixMonths}
                  scopedExpensesForSixMonths={scopedExpensesForSixMonths}
                  monthFilter={monthFilter}
                />
              </div>
            )}

            {activeSection === 'programs' && (
              <ProgramsSection
                programs={programs}
                income={income}
                expenses={expenses}
                loans={loans}
                onCreateProgram={handleCreateProgram}
                onUpdateStatus={handleUpdateProgramStatus}
                onDeleteProgram={handleDeleteProgram}
              />
            )}

            {activeSection === 'loans' && (
              <LoansSection
                loans={loans}
                committee={committee}
                programs={programs}
                programsMap={programsMap}
                userNames={userNames}
                programFilter={programFilter}
                onProgramFilterChange={setProgramFilter}
                onCreateLoan={handleCreateLoan}
                onAddRepayment={handleAddRepayment}
                onDeleteLoan={handleDeleteLoan}
              />
            )}

            {activeSection === 'settings' && (
              <SettingsSection
                org={org}
                committee={committee}
                customExpenseCategories={customExpenseCategories}
                customIncomeCategories={customIncomeCategories}
                adminAuth={state?.adminAuth}
                onSaveOrg={handleSaveOrg}
                onUpdateAdminCredentials={handleUpdateAdminCredentials}
                onAddCommitteeMember={handleAddCommitteeMember}
                onDeleteCommitteeMember={handleDeleteCommitteeMember}
                onAddCustomCategory={handleAddCustomCategory}
                onDeleteCustomCategory={handleDeleteCustomCategory}
                onTogglePublicView={handleTogglePublicView}
                onOpenPublicView={handleOpenPublicView}
                onDownloadBackup={handleDownloadBackup}
                onRestoreBackup={handleRestoreBackup}
                onOpenShareModal={() => setAccountModalOpen(true)}
              />
            )}
          </main>
        </div>
      )}

      <footer className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 border-t border-[#e6e2da] dark:border-[#303030] text-xs text-[#5c5852] dark:text-[#b8b8b8] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span>{org.orgName} · Unit Financial Ledger</span>
        <span>All amounts in Indian rupees (₹) · Live shared accounts</span>
      </footer>

      {currentUser && (
        <AccountModal
          open={accountModalOpen}
          onClose={() => setAccountModalOpen(false)}
          currentUser={currentUser}
          users={state?.users}
          publicViewEnabled={org.publicViewEnabled !== false}
          onTogglePublicView={handleTogglePublicView}
          onOpenPublicView={handleOpenPublicView}
          onAdminLogin={handleAdminLogin}
          onSwitchAccount={handleSwitchAccount}
          onLogout={handleLogout}
          onInviteUser={handleInviteUser}
          onRemoveUser={handleRemoveUser}
        />
      )}
    </div>
  );
}
