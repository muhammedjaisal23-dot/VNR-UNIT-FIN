import type {
  AppStatePayload,
  AuthStatusPayload,
  DatabaseSnapshot,
  PublicStatePayload,
  UserRole,
} from '../types';

// Keep Bearer session token strictly in JS memory (never in localStorage/sessionStorage)
let memoryAuthToken: string | null = null;

// Clean up any legacy token previously saved in localStorage
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('ssf-vnr-session-token');
  }
} catch {
  // ignore storage access issues
}

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

export function setAuthToken(token: string | null): void {
  memoryAuthToken = token;
}

export function clearAuthToken(): void {
  memoryAuthToken = null;
}

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (memoryAuthToken) {
    headers['Authorization'] = `Bearer ${memoryAuthToken}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/api/auth/admin-login') {
      memoryAuthToken = null;
    }
    if (!res.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`);
    }
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAuthStatus(timeoutMs = 10000): Promise<AuthStatusPayload> {
  return requestJson<AuthStatusPayload>('/api/auth/status', {}, timeoutMs);
}

export async function setupAdminCredentials(
  username: string,
  password: string
): Promise<AppStatePayload> {
  const res = await requestJson<{ token: string; state: AppStatePayload }>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (res.token) setAuthToken(res.token);
  return res.state;
}

export async function loginAdmin(username: string, password: string): Promise<AppStatePayload> {
  const res = await requestJson<{ token: string; state: AppStatePayload }>('/api/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (res.token) setAuthToken(res.token);
  return res.state;
}

export async function updateAdminCredentials(payload: {
  currentPassword: string;
  username: string;
  newPassword?: string;
}): Promise<AppStatePayload> {
  const res = await requestJson<{ token: string; state: AppStatePayload }>(
    '/api/auth/admin-credentials',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  if (res.token) setAuthToken(res.token);
  return res.state;
}

export async function logoutSession(): Promise<void> {
  try {
    if (memoryAuthToken) {
      await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }, 5000);
    }
  } catch {
    // always clear client memory token even if server already restarted
  } finally {
    clearAuthToken();
  }
}

export async function fetchState(timeoutMs = 10000): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>('/api/state', {}, timeoutMs);
  return res.state;
}

export async function loginByEmail(email: string, name?: string): Promise<AppStatePayload> {
  const res = await requestJson<{ token: string; state: AppStatePayload }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, name }),
  });
  if (res.token) setAuthToken(res.token);
  return res.state;
}

export async function inviteUser(payload: {
  email: string;
  name: string;
  role: Extract<UserRole, 'secretary' | 'viewer'>;
}): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>('/api/users/invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.state;
}

export async function removeInvitedUser(id: string): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>(`/api/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.state;
}

export async function updateOrg(payload: {
  orgName: string;
  openingBalance: number;
}): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>('/api/org', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.state;
}

export async function createProgram(payload: { name: string; date: string }): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>('/api/programs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.state;
}

export async function updateProgramStatus(
  id: string,
  status: 'open' | 'closed'
): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>(`/api/programs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return res.state;
}

export async function deleteProgram(id: string): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>(`/api/programs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.state;
}

export async function createEntry(
  type: 'income' | 'expense',
  payload: {
    date: string;
    amount: number;
    category: string;
    note: string;
    programId: string | null;
  }
): Promise<AppStatePayload> {
  const endpoint = type === 'income' ? '/api/income' : '/api/expenses';
  const res = await requestJson<{ state: AppStatePayload }>(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.state;
}

export async function updateEntry(
  type: 'income' | 'expense',
  id: string,
  payload: {
    date: string;
    amount: number;
    category: string;
    note: string;
    programId: string | null;
  }
): Promise<AppStatePayload> {
  const endpoint = type === 'income' ? `/api/income/${encodeURIComponent(id)}` : `/api/expenses/${encodeURIComponent(id)}`;
  const res = await requestJson<{ state: AppStatePayload }>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.state;
}

export async function deleteEntry(type: 'income' | 'expense', id: string): Promise<AppStatePayload> {
  const endpoint = type === 'income' ? `/api/income/${encodeURIComponent(id)}` : `/api/expenses/${encodeURIComponent(id)}`;
  const res = await requestJson<{ state: AppStatePayload }>(endpoint, {
    method: 'DELETE',
  });
  return res.state;
}

export async function createLoan(payload: {
  name: string;
  source: 'committee' | 'outside';
  amount: number;
  date: string;
  programId: string | null;
  note: string;
}): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>('/api/loans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.state;
}

export async function addLoanRepayment(
  loanId: string,
  payload: { amount: number; date: string }
): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>(
    `/api/loans/${encodeURIComponent(loanId)}/repayments`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return res.state;
}

export async function deleteLoan(loanId: string): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>(`/api/loans/${encodeURIComponent(loanId)}`, {
    method: 'DELETE',
  });
  return res.state;
}

export async function addCommitteeMember(name: string): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>('/api/committee', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return res.state;
}

export async function deleteCommitteeMember(id: string): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>(`/api/committee/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.state;
}

export async function addCustomCategory(
  type: 'income' | 'expense',
  name: string
): Promise<{ category: string; state: AppStatePayload }> {
  return requestJson<{ category: string; state: AppStatePayload }>('/api/categories', {
    method: 'POST',
    body: JSON.stringify({ type, name }),
  });
}

export async function deleteCustomCategory(
  type: 'income' | 'expense',
  name: string
): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>('/api/categories', {
    method: 'DELETE',
    body: JSON.stringify({ type, name }),
  });
  return res.state;
}

export async function restoreDatabaseSnapshot(
  mode: 'auto' | 'manual',
  snapshot: DatabaseSnapshot
): Promise<{ restored: boolean; state: AppStatePayload }> {
  return requestJson<{ restored: boolean; state: AppStatePayload }>('/api/sync/restore', {
    method: 'POST',
    body: JSON.stringify({ mode, snapshot }),
  });
}

export async function fetchPublicState(timeoutMs = 10000): Promise<PublicStatePayload> {
  return requestJson<PublicStatePayload>('/api/public', {}, timeoutMs);
}

export async function setPublicViewEnabled(enabled: boolean): Promise<AppStatePayload> {
  const res = await requestJson<{ state: AppStatePayload }>('/api/public-view', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
  return res.state;
}

export function subscribeToUpdates(onSync: () => void): () => void {
  let closed = false;
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    source = new EventSource('/api/events');
    source.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === 'sync') {
          onSync();
        }
      } catch {
        // ignore malformed heartbeat
      }
    };
    source.onerror = () => {
      source?.close();
      source = null;
      if (!closed) {
        retryTimer = setTimeout(connect, 3000);
      }
    };
  };

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    source?.close();
  };
}
