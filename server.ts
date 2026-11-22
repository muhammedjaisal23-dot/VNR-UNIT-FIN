import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';

interface OrgMeta {
  orgName: string;
  openingBalance: number;
  publicViewEnabled: boolean;
}

interface ProgramRecord {
  id: string;
  name: string;
  date: string;
  status: 'open' | 'closed';
  createdAt: number;
  closedAt: number | null;
}

interface EntryRecord {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  programId: string | null;
  addedBy: string;
  timestamp: number;
}

interface LoanRepayment {
  id: string;
  amount: number;
  date: string;
  ts: number;
}

interface LoanRecord {
  id: string;
  name: string;
  source: 'committee' | 'outside';
  amount: number;
  date: string;
  programId: string | null;
  note: string;
  addedBy: string;
  timestamp: number;
  repayments: LoanRepayment[];
}

interface CommitteeMember {
  id: string;
  name: string;
  ts: number;
}

interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'secretary' | 'viewer';
  createdAt: number;
}

interface CustomCategories {
  expense: string[];
  income: string[];
}

interface AdminAuthRecord {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  updatedAt: number;
}

interface FinanceDatabase {
  revision: number;
  meta: {
    org: OrgMeta;
  };
  programs: ProgramRecord[];
  income: EntryRecord[];
  expenses: EntryRecord[];
  loans: LoanRecord[];
  committee: CommitteeMember[];
  users: UserAccount[];
  customCategories: CustomCategories;
  adminAuth: AdminAuthRecord | null;
}

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'muhammedjaisal23@gmail.com').toLowerCase().trim();
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'finance-db.json');

const DEFAULT_EXPENSE_CATEGORIES = [
  'Programme expense',
  'Rent',
  'Travel',
  'Food',
  'Printing / notices',
  'Relief aid',
  'Other',
];

const DEFAULT_INCOME_CATEGORIES = [
  'Membership fee',
  'Donation',
  'Programme collection',
  'Other',
];

function sanitizeCategoryString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > 60) return null;
  return cleaned;
}

function normalizeCustomCategoryList(
  defaults: string[],
  rawList: unknown,
  entries: EntryRecord[]
): string[] {
  const defaultLower = new Set(defaults.map((c) => c.toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];

  const pushIfCustom = (val: unknown) => {
    const cleaned = sanitizeCategoryString(val);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (defaultLower.has(key) || seen.has(key)) return;
    seen.add(key);
    result.push(cleaned);
  };

  if (Array.isArray(rawList)) {
    for (const item of rawList) pushIfCustom(item);
  }
  for (const entry of entries) {
    pushIfCustom(entry.category);
  }

  return result;
}

function resolveAndRegisterCategory(type: 'income' | 'expense', raw: unknown): string | null {
  const cleaned = sanitizeCategoryString(raw);
  if (!cleaned) return null;

  const defaults = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const lower = cleaned.toLowerCase();

  const defaultMatch = defaults.find((c) => c.toLowerCase() === lower);
  if (defaultMatch) return defaultMatch;

  const customList = db.customCategories[type];
  const customMatch = customList.find((c) => c.toLowerCase() === lower);
  if (customMatch) return customMatch;

  customList.push(cleaned);
  return cleaned;
}

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function createInitialDb(): FinanceDatabase {
  return {
    revision: 0,
    meta: {
      org: {
        orgName: 'SSF VNR Unit',
        openingBalance: 0,
        publicViewEnabled: true,
      },
    },
    programs: [],
    income: [
      {
        id: 'inc_seed_20261120_1',
        date: '2026-11-20',
        amount: 100,
        category: 'Other',
        note: 'SSF calendar income',
        programId: null,
        addedBy: 'usr_owner',
        timestamp: Date.parse('2026-11-20T12:00:00Z'),
      },
      {
        id: 'inc_seed_20261117_1',
        date: '2026-11-17',
        amount: 100,
        category: 'Other',
        note: 'SSF calendar income',
        programId: null,
        addedBy: 'usr_owner',
        timestamp: Date.parse('2026-11-17T12:00:00Z'),
      },
      {
        id: 'inc_seed_20261113_2',
        date: '2026-11-13',
        amount: 700,
        category: 'Other',
        note: 'SSF calendar income',
        programId: null,
        addedBy: 'usr_owner',
        timestamp: Date.parse('2026-11-13T14:00:00Z'),
      },
      {
        id: 'inc_seed_20261113_1',
        date: '2026-11-13',
        amount: 900,
        category: 'Other',
        note: 'SSF calendar income',
        programId: null,
        addedBy: 'usr_owner',
        timestamp: Date.parse('2026-11-13T10:00:00Z'),
      },
    ],
    expenses: [
      {
        id: 'exp_seed_20261116_1',
        date: '2026-11-16',
        amount: 530,
        category: 'Programme expense',
        note: 'Bayan trophy (paid from SSF money held by Umar)',
        programId: null,
        addedBy: 'usr_owner',
        timestamp: Date.parse('2026-11-16T12:00:00Z'),
      },
      {
        id: 'exp_seed_20261107_1',
        date: '2026-11-07',
        amount: 160,
        category: 'Printing / notices',
        note: 'Fill the life, Feel the life',
        programId: null,
        addedBy: 'usr_owner',
        timestamp: Date.parse('2026-11-07T12:00:00Z'),
      },
    ],
    loans: [],
    committee: [],
    users: [
      {
        id: 'usr_owner',
        email: OWNER_EMAIL,
        name: 'Finance Admin',
        role: 'admin',
        createdAt: Date.now(),
      },
    ],
    customCategories: {
      expense: [],
      income: [],
    },
    adminAuth: null,
  };
}

function loadDb(): FinanceDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = createInitialDb();
      saveDb(initial, false);
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<FinanceDatabase>;
    const fallback = createInitialDb();
    const loadedIncome = Array.isArray(parsed.income) ? parsed.income : [];
    const loadedExpenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
    const loadedPrograms = Array.isArray(parsed.programs) ? parsed.programs : [];
    const loadedLoans = Array.isArray(parsed.loans) ? parsed.loans : [];
    const loadedCommittee = Array.isArray(parsed.committee) ? parsed.committee : [];
    const inferredHasData =
      loadedIncome.length > 0 ||
      loadedExpenses.length > 0 ||
      loadedPrograms.length > 0 ||
      loadedLoans.length > 0 ||
      loadedCommittee.length > 0;
    const loadedRevision =
      typeof parsed.revision === 'number' && Number.isFinite(parsed.revision) && parsed.revision >= 0
        ? parsed.revision
        : inferredHasData
          ? 1
          : 0;

    const db: FinanceDatabase = {
      revision: loadedRevision,
      meta: {
        org: {
          orgName: typeof parsed.meta?.org?.orgName === 'string' && parsed.meta.org.orgName.trim()
            ? parsed.meta.org.orgName.trim()
            : fallback.meta.org.orgName,
          openingBalance: Number.isFinite(Number(parsed.meta?.org?.openingBalance))
            ? Number(parsed.meta?.org?.openingBalance)
            : 0,
          publicViewEnabled:
            typeof parsed.meta?.org?.publicViewEnabled === 'boolean'
              ? parsed.meta.org.publicViewEnabled
              : true,
        },
      },
      programs: loadedPrograms,
      income: loadedIncome,
      expenses: loadedExpenses,
      loans: loadedLoans,
      committee: loadedCommittee,
      users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : fallback.users,
      customCategories: {
        expense: normalizeCustomCategoryList(
          DEFAULT_EXPENSE_CATEGORIES,
          parsed.customCategories?.expense,
          parsed.customCategories ? [] : loadedExpenses
        ),
        income: normalizeCustomCategoryList(
          DEFAULT_INCOME_CATEGORIES,
          parsed.customCategories?.income,
          parsed.customCategories ? [] : loadedIncome
        ),
      },
      adminAuth:
        parsed.adminAuth &&
        typeof parsed.adminAuth.username === 'string' &&
        parsed.adminAuth.username.trim().length >= 3 &&
        typeof parsed.adminAuth.passwordHash === 'string' &&
        parsed.adminAuth.passwordHash.length >= 64 &&
        typeof parsed.adminAuth.passwordSalt === 'string' &&
        parsed.adminAuth.passwordSalt.length >= 16
          ? {
              username: parsed.adminAuth.username.trim(),
              passwordHash: parsed.adminAuth.passwordHash,
              passwordSalt: parsed.adminAuth.passwordSalt,
              updatedAt: Number.isFinite(Number(parsed.adminAuth.updatedAt))
                ? Number(parsed.adminAuth.updatedAt)
                : Date.now(),
            }
          : null,
    };

    // Ensure owner account always exists with admin role
    if (!db.users.some((u) => u.email.toLowerCase() === OWNER_EMAIL)) {
      db.users.unshift(fallback.users[0]);
    }
    return db;
  } catch (err) {
    console.error('Failed to read database file, initializing fresh store:', err);
    return createInitialDb();
  }
}

function saveDb(targetDb: FinanceDatabase, bumpRevision = true): void {
  if (bumpRevision) {
    targetDb.revision = (Number.isFinite(targetDb.revision) ? targetDb.revision : 0) + 1;
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(targetDb, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

let db = loadDb();

// --- Live SSE Clients ---
interface SseClient {
  id: string;
  res: Response;
}

const sseClients = new Map<string, SseClient>();

function broadcastUpdate(reason: string): void {
  const payload = `data: ${JSON.stringify({ type: 'sync', reason, ts: Date.now() })}\n\n`;
  for (const [id, client] of sseClients.entries()) {
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(id);
    }
  }
}

// --- Password Hashing & Admin Credentials ---
function sanitizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (cleaned.length < 3 || cleaned.length > 40) return null;
  if (!/^[a-zA-Z0-9._@-]+$/.test(cleaned)) return null;
  return cleaned;
}

function validatePassword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length < 6 || raw.length > 128) return null;
  return raw;
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const effectiveSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, effectiveSalt, 64).toString('hex');
  return { hash: derived, salt: effectiveSalt };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function verifyPasswordHash(password: string, salt: string, expectedHashHex: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function getEnvAdminCredentials(): { username: string; password: string } | null {
  const envPassword = typeof process.env.ADMIN_PASSWORD === 'string' ? process.env.ADMIN_PASSWORD : '';
  if (!envPassword.trim()) return null;
  const envUsername =
    typeof process.env.ADMIN_USERNAME === 'string' && process.env.ADMIN_USERNAME.trim()
      ? process.env.ADMIN_USERNAME.trim()
      : 'admin';
  return { username: envUsername, password: envPassword };
}

function isAdminConfigured(): boolean {
  return getEnvAdminCredentials() !== null || db.adminAuth !== null;
}

function getActiveAdminUsername(): string {
  const envCreds = getEnvAdminCredentials();
  if (envCreds) return envCreds.username;
  return db.adminAuth?.username || 'admin';
}

function getOwnerAdminUser(): UserAccount {
  return db.users.find((u) => u.role === 'admin') || db.users[0];
}

// --- In-Memory Login Rate Limiter ---
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 10;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (now > entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_LOGIN_FAILURES;
}

function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearLoginFailures(ip: string): void {
  loginAttempts.delete(ip);
}

// --- Server-Side Bearer Session Store ---
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 500;
const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

interface SessionRecord {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const activeSessions = new Map<string, SessionRecord>();

function createSessionToken(userId: string): string {
  const now = Date.now();
  // Prune expired sessions
  if (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
    for (const [key, sess] of activeSessions.entries()) {
      if (sess.expiresAt <= now) activeSessions.delete(key);
    }
    while (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
      const oldestKey = activeSessions.keys().next().value;
      if (!oldestKey) break;
      activeSessions.delete(oldestKey);
    }
  }
  const nonce = crypto.randomBytes(24).toString('hex');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(`${userId}:${nonce}`)
    .digest('hex')
    .slice(0, 32);
  const token = `${nonce}.${sig}`;
  activeSessions.set(token, {
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return token;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

function resolveRequestUser(req: Request): UserAccount | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  const user = db.users.find((u) => u.id === session.userId) || null;
  if (!user) {
    activeSessions.delete(token);
    return null;
  }
  return user;
}

function revokeUserSessions(userId: string, exceptToken?: string | null): void {
  for (const [token, sess] of activeSessions.entries()) {
    if (sess.userId === userId && token !== exceptToken) {
      activeSessions.delete(token);
    }
  }
}

function requireAuth(req: Request, res: Response): UserAccount | null {
  const user = resolveRequestUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return null;
  }
  return user;
}

function requireAdmin(req: Request, res: Response, forbiddenMsg: string): UserAccount | null {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: forbiddenMsg });
    return null;
  }
  return user;
}

function isValidISODate(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function buildStateForUser(user: UserAccount) {
  const userNames: Record<string, string> = {};
  for (const u of db.users) {
    userNames[u.id] = u.name;
  }

  const base = {
    revision: db.revision,
    currentUser: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    org: db.meta.org,
    programs: db.programs,
    income: db.income,
    expenses: db.expenses,
    customCategories: db.customCategories,
    userNames,
  };

  // Strict server-side access rule: loans, committee, user list, and adminAuth metadata are OWNER/ADMIN ONLY
  if (user.role === 'admin') {
    return {
      ...base,
      loans: db.loans,
      committee: db.committee,
      users: db.users,
      adminAuth: {
        username: getActiveAdminUsername(),
        envConfigured: getEnvAdminCredentials() !== null,
      },
    };
  }

  return base;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // --- SSE Live Updates Stream ---
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = makeId('sse');
    sseClients.set(clientId, { id: clientId, res });
    res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(clientId);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(clientId);
    });
  });

  // --- Auth Status (Safe unauthenticated check for login vs first-run setup) ---
  app.get('/api/auth/status', (req, res) => {
    const user = resolveRequestUser(req);
    const envConfigured = getEnvAdminCredentials() !== null;
    res.json({
      adminConfigured: isAdminConfigured(),
      envConfigured,
      publicViewEnabled: db.meta.org.publicViewEnabled !== false,
      orgName: db.meta.org.orgName,
      authenticated: user !== null,
      ...(user ? { state: buildStateForUser(user) } : {}),
    });
  });

  // --- One-Time First-Run Admin Setup / Claim Route ---
  app.post('/api/auth/setup', (req, res) => {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
      return;
    }

    if (isAdminConfigured()) {
      res.status(403).json({
        error: 'Admin credentials are already configured. Please sign in with your username and password.',
      });
      return;
    }

    const username = sanitizeUsername(req.body?.username);
    const password = validatePassword(req.body?.password);

    if (!username) {
      res.status(400).json({
        error: 'Username must be 3–40 characters using letters, numbers, dots, underscores, hyphens, or @.',
      });
      return;
    }
    if (!password) {
      res.status(400).json({
        error: 'Password must be between 6 and 128 characters.',
      });
      return;
    }

    const { hash, salt } = hashPassword(password);
    db.adminAuth = {
      username,
      passwordHash: hash,
      passwordSalt: salt,
      updatedAt: Date.now(),
    };
    saveDb(db, false);
    clearLoginFailures(ip);

    const owner = getOwnerAdminUser();
    const token = createSessionToken(owner.id);
    res.status(201).json({
      token,
      state: buildStateForUser(owner),
    });
  });

  // --- Admin Panel Sign In (Username & Password) ---
  app.post('/api/auth/admin-login', (req, res) => {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.status(429).json({ error: 'Too many failed sign-in attempts. Please try again in 15 minutes.' });
      return;
    }

    const usernameRaw = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const passwordRaw = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!usernameRaw || !passwordRaw) {
      res.status(400).json({ error: 'Enter both username and password.' });
      return;
    }

    const envCreds = getEnvAdminCredentials();
    let valid = false;

    if (envCreds) {
      // Environment-configured credentials always take precedence over any claimed hash
      const userOk = timingSafeStringEqual(usernameRaw.toLowerCase(), envCreds.username.toLowerCase());
      const passOk = timingSafeStringEqual(passwordRaw, envCreds.password);
      valid = userOk && passOk;
    } else if (db.adminAuth) {
      const userOk = timingSafeStringEqual(usernameRaw.toLowerCase(), db.adminAuth.username.toLowerCase());
      const passOk = verifyPasswordHash(passwordRaw, db.adminAuth.passwordSalt, db.adminAuth.passwordHash);
      valid = userOk && passOk;
    } else {
      res.status(409).json({ error: 'Admin login is not set up yet. Please create your admin username and password first.' });
      return;
    }

    if (!valid) {
      recordLoginFailure(ip);
      res.status(401).json({ error: 'Invalid admin username or password.' });
      return;
    }

    clearLoginFailures(ip);
    const owner = getOwnerAdminUser();
    const token = createSessionToken(owner.id);
    res.json({
      token,
      state: buildStateForUser(owner),
    });
  });

  // --- Update Admin Username & Password (Admin Only) ---
  app.put('/api/auth/admin-credentials', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can update admin login credentials.');
    if (!user) return;

    if (getEnvAdminCredentials()) {
      res.status(400).json({
        error: 'Admin credentials are managed via server environment secrets (ADMIN_USERNAME / ADMIN_PASSWORD). Update them in Settings -> Secrets.',
      });
      return;
    }

    if (!db.adminAuth) {
      res.status(400).json({ error: 'Admin credentials are not initialized yet.' });
      return;
    }

    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    if (!currentPassword || !verifyPasswordHash(currentPassword, db.adminAuth.passwordSalt, db.adminAuth.passwordHash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const nextUsername = sanitizeUsername(req.body?.username);
    if (!nextUsername) {
      res.status(400).json({
        error: 'Username must be 3–40 characters using letters, numbers, dots, underscores, hyphens, or @.',
      });
      return;
    }

    const rawNewPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    let nextHash = db.adminAuth.passwordHash;
    let nextSalt = db.adminAuth.passwordSalt;
    let passwordChanged = false;

    if (rawNewPassword.length > 0) {
      const validated = validatePassword(rawNewPassword);
      if (!validated) {
        res.status(400).json({ error: 'New password must be between 6 and 128 characters.' });
        return;
      }
      const hashed = hashPassword(validated);
      nextHash = hashed.hash;
      nextSalt = hashed.salt;
      passwordChanged = true;
    }

    db.adminAuth = {
      username: nextUsername,
      passwordHash: nextHash,
      passwordSalt: nextSalt,
      updatedAt: Date.now(),
    };
    saveDb(db, false);

    // Revoke other admin sessions and issue a fresh token for the caller
    const callerToken = extractBearerToken(req);
    revokeUserSessions(user.id, passwordChanged ? null : callerToken);
    const freshToken = passwordChanged ? createSessionToken(user.id) : callerToken || createSessionToken(user.id);

    res.json({
      token: freshToken,
      state: buildStateForUser(user),
    });
  });

  // --- Sign Out / Revoke Session ---
  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      activeSessions.delete(token);
    }
    res.json({ ok: true });
  });

  // --- Auth: Sign in as Secretary or Viewer by Email (Admin must use username + password) ---
  app.post('/api/auth/login', (req, res) => {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const nameRaw = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';

    if (!emailRaw || !emailRaw.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    let user = db.users.find((u) => u.email.toLowerCase() === emailRaw);
    if (emailRaw === OWNER_EMAIL || user?.role === 'admin') {
      res.status(403).json({
        error: 'Finance Admin access requires signing in with the Admin username and password.',
      });
      return;
    }

    if (!user) {
      // Uninvited email gets view-only access
      user = {
        id: makeId('usr'),
        email: emailRaw,
        name: nameRaw || emailRaw.split('@')[0],
        role: 'viewer',
        createdAt: Date.now(),
      };
      db.users.push(user);
      saveDb(db);
      broadcastUpdate('user-added');
    } else if (nameRaw && nameRaw !== user.name) {
      user.name = nameRaw;
      saveDb(db);
      broadcastUpdate('user-updated');
    }

    const token = createSessionToken(user.id);
    res.json({
      token,
      state: buildStateForUser(user),
    });
  });

  // --- Fetch Full Role-Scoped State (Requires Authentication) ---
  app.get('/api/state', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json({
      state: buildStateForUser(user),
    });
  });

  // --- Public Read-Only View (NEVER exposes loans, committee, user emails, or adminAuth) ---
  app.get('/api/public', (_req, res) => {
    const enabled = db.meta.org.publicViewEnabled !== false;
    if (!enabled) {
      res.json({
        enabled: false,
        orgName: db.meta.org.orgName,
      });
      return;
    }

    const userNames: Record<string, string> = {};
    for (const u of db.users) {
      userNames[u.id] = u.name;
    }

    res.json({
      enabled: true,
      revision: db.revision,
      org: {
        orgName: db.meta.org.orgName,
        openingBalance: db.meta.org.openingBalance,
        publicViewEnabled: true,
      },
      programs: db.programs,
      income: db.income,
      expenses: db.expenses,
      userNames,
    });
  });

  // --- Toggle Public View (Admin Only) ---
  app.put('/api/public-view', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can change public view settings.');
    if (!user) return;

    const enabled = Boolean(req.body?.enabled);
    db.meta.org = {
      ...db.meta.org,
      publicViewEnabled: enabled,
    };
    saveDb(db);
    broadcastUpdate('org');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Sync / Restore Snapshot (Admin Only) ---
  // mode: 'auto' only restores when the server restarted with an empty database (revision === 0).
  // mode: 'manual' restores an explicit backup file chosen by the finance admin.
  app.post('/api/sync/restore', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can restore account data.');
    if (!user) return;

    const mode = req.body?.mode === 'manual' ? 'manual' : 'auto';
    if (mode === 'auto' && db.revision > 0) {
      res.json({ restored: false, state: buildStateForUser(user) });
      return;
    }

    const snap = req.body?.snapshot;
    if (!snap || typeof snap !== 'object') {
      res.status(400).json({ error: 'Invalid backup snapshot.' });
      return;
    }

    const orgName =
      typeof snap.org?.orgName === 'string' && snap.org.orgName.trim()
        ? snap.org.orgName.trim().slice(0, 120)
        : 'SSF VNR Unit';
    const openingBalance = Number.isFinite(Number(snap.org?.openingBalance))
      ? Number(snap.org.openingBalance)
      : 0;

    const cleanPrograms: ProgramRecord[] = Array.isArray(snap.programs)
      ? (snap.programs as unknown[])
          .filter(
            (p): p is Record<string, unknown> =>
              !!p &&
              typeof p === 'object' &&
              typeof (p as Record<string, unknown>).id === 'string' &&
              typeof (p as Record<string, unknown>).name === 'string' &&
              isValidISODate((p as Record<string, unknown>).date)
          )
          .map((p: Record<string, unknown>) => ({
            id: String(p.id).slice(0, 64),
            name: String(p.name).trim().slice(0, 140),
            date: String(p.date),
            status: p.status === 'closed' ? 'closed' : 'open',
            createdAt: Number.isFinite(Number(p.createdAt)) ? Number(p.createdAt) : Date.now(),
            closedAt:
              p.status === 'closed' && Number.isFinite(Number(p.closedAt))
                ? Number(p.closedAt)
                : null,
          }))
      : [];

    const sanitizeEntries = (list: unknown): EntryRecord[] =>
      Array.isArray(list)
        ? (list as unknown[])
            .filter(
              (e): e is Record<string, unknown> =>
                !!e &&
                typeof e === 'object' &&
                typeof (e as Record<string, unknown>).id === 'string' &&
                isValidISODate((e as Record<string, unknown>).date) &&
                Number.isFinite(Number((e as Record<string, unknown>).amount)) &&
                Number((e as Record<string, unknown>).amount) > 0
            )
            .map((e: Record<string, unknown>) => ({
              id: String(e.id).slice(0, 64),
              date: String(e.date),
              amount: Math.round(Number(e.amount) * 100) / 100,
              category: sanitizeCategoryString(e.category) || 'Other',
              note: typeof e.note === 'string' ? e.note.trim().slice(0, 400) : '',
              programId: typeof e.programId === 'string' && e.programId ? e.programId : null,
              addedBy: typeof e.addedBy === 'string' && e.addedBy ? e.addedBy : user.id,
              timestamp: Number.isFinite(Number(e.timestamp)) ? Number(e.timestamp) : Date.now(),
            }))
        : [];

    const cleanIncome = sanitizeEntries(snap.income);
    const cleanExpenses = sanitizeEntries(snap.expenses);

    const cleanLoans: LoanRecord[] = Array.isArray(snap.loans)
      ? (snap.loans as unknown[])
          .filter(
            (l): l is Record<string, unknown> =>
              !!l &&
              typeof l === 'object' &&
              typeof (l as Record<string, unknown>).id === 'string' &&
              typeof (l as Record<string, unknown>).name === 'string' &&
              isValidISODate((l as Record<string, unknown>).date) &&
              Number.isFinite(Number((l as Record<string, unknown>).amount)) &&
              Number((l as Record<string, unknown>).amount) > 0
          )
          .map((l: Record<string, unknown>) => ({
            id: String(l.id).slice(0, 64),
            name: String(l.name).trim().slice(0, 140),
            source: l.source === 'committee' ? 'committee' : 'outside',
            amount: Math.round(Number(l.amount) * 100) / 100,
            date: String(l.date),
            programId: typeof l.programId === 'string' && l.programId ? l.programId : null,
            note: typeof l.note === 'string' ? l.note.trim().slice(0, 400) : '',
            addedBy: typeof l.addedBy === 'string' && l.addedBy ? l.addedBy : user.id,
            timestamp: Number.isFinite(Number(l.timestamp)) ? Number(l.timestamp) : Date.now(),
            repayments: Array.isArray(l.repayments)
              ? (l.repayments as unknown[])
                  .filter(
                    (r): r is Record<string, unknown> =>
                      !!r &&
                      typeof r === 'object' &&
                      isValidISODate((r as Record<string, unknown>).date) &&
                      Number.isFinite(Number((r as Record<string, unknown>).amount)) &&
                      Number((r as Record<string, unknown>).amount) > 0
                  )
                  .map((r: Record<string, unknown>) => ({
                    id: typeof r.id === 'string' ? r.id.slice(0, 64) : makeId('rep'),
                    amount: Math.round(Number(r.amount) * 100) / 100,
                    date: String(r.date),
                    ts: Number.isFinite(Number(r.ts)) ? Number(r.ts) : Date.now(),
                  }))
              : [],
          }))
      : [];

    const cleanCommittee: CommitteeMember[] = Array.isArray(snap.committee)
      ? (snap.committee as unknown[])
          .filter(
            (m): m is Record<string, unknown> =>
              !!m &&
              typeof m === 'object' &&
              typeof (m as Record<string, unknown>).name === 'string' &&
              String((m as Record<string, unknown>).name).trim().length > 0
          )
          .map((m: Record<string, unknown>) => ({
            id: typeof m.id === 'string' ? m.id.slice(0, 64) : makeId('cmt'),
            name: String(m.name).trim().slice(0, 100),
            ts: Number.isFinite(Number(m.ts)) ? Number(m.ts) : Date.now(),
          }))
      : [];

    const existingOwner = db.users.find((u) => u.email.toLowerCase() === OWNER_EMAIL) || user;
    const mergedUsers: UserAccount[] = [existingOwner];
    if (Array.isArray(snap.users)) {
      for (const u of snap.users) {
        if (!u || typeof u !== 'object') continue;
        const rec = u as Record<string, unknown>;
        const email = typeof rec.email === 'string' ? rec.email.trim().toLowerCase() : '';
        if (!email || !email.includes('@') || email === OWNER_EMAIL) continue;
        if (mergedUsers.some((m) => m.email.toLowerCase() === email)) continue;
        mergedUsers.push({
          id: typeof rec.id === 'string' && rec.id ? rec.id.slice(0, 64) : makeId('usr'),
          email,
          name:
            typeof rec.name === 'string' && rec.name.trim()
              ? rec.name.trim().slice(0, 80)
              : email.split('@')[0],
          role: rec.role === 'secretary' ? 'secretary' : 'viewer',
          createdAt: Number.isFinite(Number(rec.createdAt)) ? Number(rec.createdAt) : Date.now(),
        });
      }
    }

    const incomingRev =
      typeof snap.revision === 'number' && Number.isFinite(snap.revision) && snap.revision > 0
        ? Math.floor(snap.revision)
        : 1;

    const publicViewEnabled =
      typeof snap.org?.publicViewEnabled === 'boolean' ? snap.org.publicViewEnabled : true;

    db = {
      revision: Math.max(db.revision + 1, incomingRev),
      meta: {
        org: { orgName, openingBalance, publicViewEnabled },
      },
      programs: cleanPrograms,
      income: cleanIncome,
      expenses: cleanExpenses,
      loans: cleanLoans,
      committee: cleanCommittee,
      users: mergedUsers,
      customCategories: {
        expense: normalizeCustomCategoryList(
          DEFAULT_EXPENSE_CATEGORIES,
          snap.customCategories?.expense,
          cleanExpenses
        ),
        income: normalizeCustomCategoryList(
          DEFAULT_INCOME_CATEGORIES,
          snap.customCategories?.income,
          cleanIncome
        ),
      },
      adminAuth: db.adminAuth,
    };

    saveDb(db, false);
    broadcastUpdate('restore');
    res.json({ restored: true, state: buildStateForUser(existingOwner) });
  });

  // --- Invite / Manage Users (Admin Only) ---
  app.post('/api/users/invite', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can invite users.');
    if (!user) return;

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
    const role = req.body?.role === 'secretary' ? 'secretary' : 'viewer';

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Enter a valid email address.' });
      return;
    }
    if (email === OWNER_EMAIL) {
      res.status(400).json({ error: 'Cannot change the finance admin owner role.' });
      return;
    }

    const existing = db.users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      existing.role = role;
      if (name) existing.name = name;
    } else {
      db.users.push({
        id: makeId('usr'),
        email,
        name: name || email.split('@')[0],
        role,
        createdAt: Date.now(),
      });
    }

    saveDb(db);
    broadcastUpdate('users');
    res.json({ state: buildStateForUser(user) });
  });

  app.delete('/api/users/:id', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can remove invited users.');
    if (!user) return;

    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (target.role === 'admin') {
      res.status(400).json({ error: 'Cannot remove the finance admin.' });
      return;
    }

    // Downgrade to viewer or remove if never authored entries; keep ID mapping if they authored entries
    const hasEntries =
      db.expenses.some((e) => e.addedBy === target.id) ||
      db.income.some((i) => i.addedBy === target.id);

    if (hasEntries) {
      target.role = 'viewer';
    } else {
      db.users = db.users.filter((u) => u.id !== target.id);
    }

    saveDb(db);
    broadcastUpdate('users');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Meta / Org (Admin Only Write) ---
  app.put('/api/org', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can edit organisation settings.');
    if (!user) return;

    const orgName = typeof req.body?.orgName === 'string' ? req.body.orgName.trim().slice(0, 120) : '';
    const openingBalance = Number(req.body?.openingBalance);

    if (!orgName) {
      res.status(400).json({ error: 'Organisation name is required.' });
      return;
    }
    if (!Number.isFinite(openingBalance)) {
      res.status(400).json({ error: 'Opening balance must be a valid number.' });
      return;
    }

    db.meta.org = {
      orgName,
      openingBalance,
      publicViewEnabled:
        typeof req.body?.publicViewEnabled === 'boolean'
          ? req.body.publicViewEnabled
          : db.meta.org.publicViewEnabled !== false,
    };
    saveDb(db);
    broadcastUpdate('org');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Programs (Admin Only Write) ---
  app.post('/api/programs', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can create programmes.');
    if (!user) return;

    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 140) : '';
    const date = req.body?.date;
    if (!name) {
      res.status(400).json({ error: 'Programme name is required.' });
      return;
    }
    if (!isValidISODate(date)) {
      res.status(400).json({ error: 'Valid programme date is required.' });
      return;
    }

    const program: ProgramRecord = {
      id: makeId('prg'),
      name,
      date,
      status: 'open',
      createdAt: Date.now(),
      closedAt: null,
    };
    db.programs.unshift(program);
    saveDb(db);
    broadcastUpdate('programs');
    res.status(201).json({ program, state: buildStateForUser(user) });
  });

  app.put('/api/programs/:id', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can update programmes.');
    if (!user) return;

    const program = db.programs.find((p) => p.id === req.params.id);
    if (!program) {
      res.status(404).json({ error: 'Programme not found.' });
      return;
    }

    if (req.body?.status === 'closed' && program.status !== 'closed') {
      program.status = 'closed';
      program.closedAt = Date.now();
    } else if (req.body?.status === 'open' && program.status !== 'open') {
      program.status = 'open';
      program.closedAt = null;
    }

    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      program.name = req.body.name.trim().slice(0, 140);
    }
    if (isValidISODate(req.body?.date)) {
      program.date = req.body.date;
    }

    saveDb(db);
    broadcastUpdate('programs');
    res.json({ program, state: buildStateForUser(user) });
  });

  app.delete('/api/programs/:id', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can delete programmes.');
    if (!user) return;

    const targetId = req.params.id;
    const exists = db.programs.some((p) => p.id === targetId);
    if (!exists) {
      res.status(404).json({ error: 'Programme not found.' });
      return;
    }

    db.programs = db.programs.filter((p) => p.id !== targetId);

    // Preserve financial records by unlinking them from the deleted programme (moved to General)
    for (const item of db.income) {
      if (item.programId === targetId) item.programId = null;
    }
    for (const item of db.expenses) {
      if (item.programId === targetId) item.programId = null;
    }
    for (const loan of db.loans) {
      if (loan.programId === targetId) loan.programId = null;
    }

    saveDb(db);
    broadcastUpdate('programs');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Custom Categories (Income: Admin only; Expense: Admin & Secretary) ---
  app.post('/api/categories', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const type = req.body?.type === 'income' ? 'income' : req.body?.type === 'expense' ? 'expense' : null;
    if (!type) {
      res.status(400).json({ error: 'Category type must be income or expense.' });
      return;
    }
    if (type === 'income' && user.role !== 'admin') {
      res.status(403).json({ error: 'Only the finance admin can add income categories.' });
      return;
    }
    if (type === 'expense' && user.role !== 'admin' && user.role !== 'secretary') {
      res.status(403).json({ error: 'You do not have permission to add expense categories.' });
      return;
    }

    const cleaned = sanitizeCategoryString(req.body?.name);
    if (!cleaned) {
      res.status(400).json({ error: 'Enter a valid category name (1–60 characters).' });
      return;
    }
    if (cleaned.toLowerCase() === 'other') {
      res.status(400).json({ error: 'Please enter a specific category name instead of "Other".' });
      return;
    }

    const resolved = resolveAndRegisterCategory(type, cleaned)!;
    saveDb(db);
    broadcastUpdate('categories');
    res.status(201).json({ category: resolved, state: buildStateForUser(user) });
  });

  app.delete('/api/categories', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can remove custom categories.');
    if (!user) return;

    const type = req.body?.type === 'income' ? 'income' : req.body?.type === 'expense' ? 'expense' : null;
    const cleaned = sanitizeCategoryString(req.body?.name);
    if (!type || !cleaned) {
      res.status(400).json({ error: 'Category type and name are required.' });
      return;
    }

    const lower = cleaned.toLowerCase();
    const before = db.customCategories[type].length;
    db.customCategories[type] = db.customCategories[type].filter((c) => c.toLowerCase() !== lower);
    if (db.customCategories[type].length === before) {
      res.status(404).json({ error: 'Custom category not found.' });
      return;
    }

    saveDb(db);
    broadcastUpdate('categories');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Income (Admin Only Write) ---
  app.post('/api/income', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can record income.');
    if (!user) return;

    const { date, amount, category, note, programId } = req.body || {};
    const numAmount = Number(amount);

    if (!isValidISODate(date)) {
      res.status(400).json({ error: 'Valid date is required.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than zero.' });
      return;
    }
    if (!sanitizeCategoryString(category)) {
      res.status(400).json({ error: 'Enter a valid income category (1–60 characters).' });
      return;
    }

    const cleanProgramId = typeof programId === 'string' && programId ? programId : null;
    if (cleanProgramId && !db.programs.some((p) => p.id === cleanProgramId)) {
      res.status(400).json({ error: 'Selected programme does not exist.' });
      return;
    }

    const resolvedCategory = resolveAndRegisterCategory('income', category)!;

    const record: EntryRecord = {
      id: makeId('inc'),
      date,
      amount: Math.round(numAmount * 100) / 100,
      category: resolvedCategory,
      note: typeof note === 'string' ? note.trim().slice(0, 400) : '',
      programId: cleanProgramId,
      addedBy: user.id, // Store ONLY user ID, never display name
      timestamp: Date.now(),
    };

    db.income.unshift(record);
    saveDb(db);
    broadcastUpdate('income');
    res.status(201).json({ record, state: buildStateForUser(user) });
  });

  app.put('/api/income/:id', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can edit income entries.');
    if (!user) return;

    const entry = db.income.find((i) => i.id === req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Income entry not found.' });
      return;
    }

    const { date, amount, category, note, programId } = req.body || {};
    const numAmount = Number(amount);

    if (!isValidISODate(date)) {
      res.status(400).json({ error: 'Valid date is required.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than zero.' });
      return;
    }
    if (!sanitizeCategoryString(category)) {
      res.status(400).json({ error: 'Enter a valid income category (1–60 characters).' });
      return;
    }

    const cleanProgramId = typeof programId === 'string' && programId ? programId : null;
    if (cleanProgramId && !db.programs.some((p) => p.id === cleanProgramId)) {
      res.status(400).json({ error: 'Selected programme does not exist.' });
      return;
    }

    const resolvedCategory = resolveAndRegisterCategory('income', category)!;

    entry.date = date;
    entry.amount = Math.round(numAmount * 100) / 100;
    entry.category = resolvedCategory;
    entry.note = typeof note === 'string' ? note.trim().slice(0, 400) : '';
    entry.programId = cleanProgramId;

    saveDb(db);
    broadcastUpdate('income');
    res.json({ record: entry, state: buildStateForUser(user) });
  });

  app.delete('/api/income/:id', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can delete income entries.');
    if (!user) return;

    const before = db.income.length;
    db.income = db.income.filter((i) => i.id !== req.params.id);
    if (db.income.length === before) {
      res.status(404).json({ error: 'Income entry not found.' });
      return;
    }

    saveDb(db);
    broadcastUpdate('income');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Expenses (Admin & Secretary Write; Programme closing enforced by UI, late entries flagged) ---
  app.post('/api/expenses', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'secretary') {
      res.status(403).json({ error: 'You do not have permission to add expenses.' });
      return;
    }

    const { date, amount, category, note, programId } = req.body || {};
    const numAmount = Number(amount);

    if (!isValidISODate(date)) {
      res.status(400).json({ error: 'Valid date is required.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than zero.' });
      return;
    }
    if (!sanitizeCategoryString(category)) {
      res.status(400).json({ error: 'Enter a valid expense category (1–60 characters).' });
      return;
    }

    const cleanProgramId = typeof programId === 'string' && programId ? programId : null;
    if (user.role === 'secretary' && !cleanProgramId) {
      res.status(400).json({ error: 'Secretaries must submit expenses against a programme link.' });
      return;
    }
    if (cleanProgramId && !db.programs.some((p) => p.id === cleanProgramId)) {
      res.status(400).json({ error: 'Selected programme does not exist.' });
      return;
    }

    const resolvedCategory = resolveAndRegisterCategory('expense', category)!;

    const record: EntryRecord = {
      id: makeId('exp'),
      date,
      amount: Math.round(numAmount * 100) / 100,
      category: resolvedCategory,
      note: typeof note === 'string' ? note.trim().slice(0, 400) : '',
      programId: cleanProgramId,
      addedBy: user.id, // Store ONLY user ID, never display name
      timestamp: Date.now(),
    };

    db.expenses.unshift(record);
    saveDb(db);
    broadcastUpdate('expenses');
    res.status(201).json({ record, state: buildStateForUser(user) });
  });

  app.put('/api/expenses/:id', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can edit expenses.');
    if (!user) return;

    const entry = db.expenses.find((e) => e.id === req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Expense entry not found.' });
      return;
    }

    const { date, amount, category, note, programId } = req.body || {};
    const numAmount = Number(amount);

    if (!isValidISODate(date)) {
      res.status(400).json({ error: 'Valid date is required.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than zero.' });
      return;
    }
    if (!sanitizeCategoryString(category)) {
      res.status(400).json({ error: 'Enter a valid expense category (1–60 characters).' });
      return;
    }

    const cleanProgramId = typeof programId === 'string' && programId ? programId : null;
    if (cleanProgramId && !db.programs.some((p) => p.id === cleanProgramId)) {
      res.status(400).json({ error: 'Selected programme does not exist.' });
      return;
    }

    const resolvedCategory = resolveAndRegisterCategory('expense', category)!;

    entry.date = date;
    entry.amount = Math.round(numAmount * 100) / 100;
    entry.category = resolvedCategory;
    entry.note = typeof note === 'string' ? note.trim().slice(0, 400) : '';
    entry.programId = cleanProgramId;

    saveDb(db);
    broadcastUpdate('expenses');
    res.json({ record: entry, state: buildStateForUser(user) });
  });

  app.delete('/api/expenses/:id', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const entry = db.expenses.find((e) => e.id === req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Expense entry not found.' });
      return;
    }

    if (user.role === 'secretary') {
      if (entry.addedBy !== user.id) {
        res.status(403).json({ error: 'Secretaries can only delete their own expenses.' });
        return;
      }
      const prog = entry.programId ? db.programs.find((p) => p.id === entry.programId) : null;
      if (!prog || prog.status !== 'open') {
        res.status(403).json({ error: 'Expenses can only be deleted while the programme is open.' });
        return;
      }
    } else if (user.role !== 'admin') {
      res.status(403).json({ error: 'You do not have permission to delete expenses.' });
      return;
    }

    db.expenses = db.expenses.filter((e) => e.id !== req.params.id);
    saveDb(db);
    broadcastUpdate('expenses');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Loans (Admin Only Read & Write) ---
  app.post('/api/loans', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can manage loans.');
    if (!user) return;

    const { name, source, amount, date, programId, note } = req.body || {};
    const numAmount = Number(amount);
    const cleanName = typeof name === 'string' ? name.trim().slice(0, 140) : '';

    if (!cleanName) {
      res.status(400).json({ error: 'Lender name is required.' });
      return;
    }
    if (source !== 'committee' && source !== 'outside') {
      res.status(400).json({ error: 'Invalid loan source.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Loan amount must be greater than zero.' });
      return;
    }
    if (!isValidISODate(date)) {
      res.status(400).json({ error: 'Valid loan date is required.' });
      return;
    }

    const cleanProgramId = typeof programId === 'string' && programId ? programId : null;
    if (cleanProgramId && !db.programs.some((p) => p.id === cleanProgramId)) {
      res.status(400).json({ error: 'Selected programme does not exist.' });
      return;
    }

    const loan: LoanRecord = {
      id: makeId('lon'),
      name: cleanName,
      source,
      amount: Math.round(numAmount * 100) / 100,
      date,
      programId: cleanProgramId,
      note: typeof note === 'string' ? note.trim().slice(0, 400) : '',
      addedBy: user.id, // Store ONLY user ID
      timestamp: Date.now(),
      repayments: [],
    };

    db.loans.unshift(loan);
    saveDb(db);
    broadcastUpdate('loans');
    res.status(201).json({ loan, state: buildStateForUser(user) });
  });

  app.post('/api/loans/:id/repayments', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can record repayments.');
    if (!user) return;

    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Loan not found.' });
      return;
    }

    const repaidSoFar = loan.repayments.reduce((s, r) => s + r.amount, 0);
    const remaining = Math.round((loan.amount - repaidSoFar) * 100) / 100;
    const numAmount = Math.round(Number(req.body?.amount) * 100) / 100;
    const date = req.body?.date;

    if (!isValidISODate(date)) {
      res.status(400).json({ error: 'Valid repayment date is required.' });
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ error: 'Repayment amount must be greater than zero.' });
      return;
    }
    if (numAmount > remaining + 0.001) {
      res.status(400).json({ error: `Repayment cannot exceed the remaining balance (${remaining}).` });
      return;
    }

    loan.repayments.push({
      id: makeId('rep'),
      amount: Math.min(numAmount, remaining),
      date,
      ts: Date.now(),
    });

    saveDb(db);
    broadcastUpdate('loans');
    res.json({ loan, state: buildStateForUser(user) });
  });

  app.delete('/api/loans/:id', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can delete loans.');
    if (!user) return;

    const before = db.loans.length;
    db.loans = db.loans.filter((l) => l.id !== req.params.id);
    if (db.loans.length === before) {
      res.status(404).json({ error: 'Loan not found.' });
      return;
    }

    saveDb(db);
    broadcastUpdate('loans');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Committee Members (Admin Only Read & Write) ---
  app.post('/api/committee', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can manage committee members.');
    if (!user) return;

    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : '';
    if (!name) {
      res.status(400).json({ error: 'Member name is required.' });
      return;
    }

    const member: CommitteeMember = {
      id: makeId('cmt'),
      name,
      ts: Date.now(),
    };
    db.committee.push(member);
    saveDb(db);
    broadcastUpdate('committee');
    res.status(201).json({ member, state: buildStateForUser(user) });
  });

  app.delete('/api/committee/:id', (req, res) => {
    const user = requireAdmin(req, res, 'Only the finance admin can remove committee members.');
    if (!user) return;

    const before = db.committee.length;
    db.committee = db.committee.filter((m) => m.id !== req.params.id);
    if (db.committee.length === before) {
      res.status(404).json({ error: 'Committee member not found.' });
      return;
    }

    saveDb(db);
    broadcastUpdate('committee');
    res.json({ state: buildStateForUser(user) });
  });

  // --- Vite Middleware (Dev) or Static Dist (Prod) ---
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');
  const httpServer = http.createServer(app);

  if (isProd && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SSF VNR Unit Finance server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
