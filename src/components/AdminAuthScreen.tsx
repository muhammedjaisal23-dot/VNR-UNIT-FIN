import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react';

interface AdminAuthScreenProps {
  orgName: string;
  adminConfigured: boolean;
  initialTab?: 'admin' | 'email';
  onSetupAdmin: (username: string, password: string) => Promise<void>;
  onLoginAdmin: (username: string, password: string) => Promise<void>;
  onLoginEmail: (email: string, name?: string) => Promise<void>;
}

export function AdminAuthScreen({
  orgName,
  adminConfigured,
  initialTab = 'admin',
  onSetupAdmin,
  onLoginAdmin,
  onLoginEmail,
}: AdminAuthScreenProps) {
  const isEmailOnlyLink = adminConfigured && initialTab === 'email';

  // Credentials fields (Setup or Sign In)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Programme link email fields
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminSetupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (cleanUser.length < 3 || cleanUser.length > 40) {
      setError('Username must be between 3 and 40 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9._@-]+$/.test(cleanUser)) {
      setError('Username can only contain letters, numbers, dots, underscores, hyphens, or @.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await onSetupAdmin(cleanUser, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create login.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Enter both username and password.');
      return;
    }

    setBusy(true);
    try {
      await onLoginAdmin(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid username or password.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      await onLoginEmail(email.trim(), displayName.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in with that email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-md space-y-4">
        <section className="rounded-2xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-5 sm:p-7 shadow-sm">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-[#fff3eb] dark:bg-[#262626] border border-[#ffc9ad] dark:border-[#ff4f00]/50 text-[#ff4f00] dark:text-[#ffc400] flex items-center justify-center mx-auto">
              {adminConfigured ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <h1 className="text-xl font-bold text-[#1c1c1c] dark:text-[#ffffff]">
              {!adminConfigured ? 'Create Login' : 'Sign In'}
            </h1>
            <p className="text-xs sm:text-sm text-[#5c5852] dark:text-[#b8b8b8] leading-relaxed">
              {!adminConfigured
                ? `Set a username and password to protect ${orgName} accounts.`
                : isEmailOnlyLink
                  ? `Enter your email address to continue to ${orgName}.`
                  : `Enter your username and password to access ${orgName}.`}
            </p>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-xs sm:text-sm text-[#b91c1c] dark:text-[#fca5a5] break-words">
              {error}
            </div>
          )}

          {/* First-Run Setup Form */}
          {!adminConfigured ? (
            <form onSubmit={handleAdminSetupSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="setup-admin-username"
                  className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#5c5852] dark:text-[#b8b8b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="setup-admin-username"
                    type="text"
                    required
                    autoComplete="username"
                    maxLength={40}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="w-full min-h-[46px] pl-10 pr-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="setup-admin-password"
                  className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5c5852] dark:text-[#b8b8b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="setup-admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full min-h-[46px] pl-10 pr-12 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center absolute right-0.5 top-1/2 -translate-y-1/2 text-[#5c5852] dark:text-[#b8b8b8] hover:text-[#1c1c1c] dark:hover:text-[#ffffff] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="setup-admin-confirm"
                  className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5c5852] dark:text-[#b8b8b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="setup-admin-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full min-h-[46px] pl-10 pr-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[46px] px-5 rounded-lg text-sm font-semibold cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
              >
                {busy ? 'Creating...' : 'Create Login & Continue'}
              </button>

              <p className="text-[11px] text-[#5c5852] dark:text-[#b8b8b8] text-center leading-relaxed">
                This one-time setup locks automatically once saved. You can change your username or password later in Settings.
              </p>
            </form>
          ) : !isEmailOnlyLink ? (
            /* Username & Password Sign In Form */
            <form onSubmit={handleAdminLoginSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="login-admin-username"
                  className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#5c5852] dark:text-[#b8b8b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-admin-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full min-h-[46px] pl-10 pr-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-admin-password"
                  className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5c5852] dark:text-[#b8b8b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full min-h-[46px] pl-10 pr-12 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center absolute right-0.5 top-1/2 -translate-y-1/2 text-[#5c5852] dark:text-[#b8b8b8] hover:text-[#1c1c1c] dark:hover:text-[#ffffff] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[46px] px-5 rounded-lg text-sm font-semibold cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
              >
                {busy ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            /* Programme Link Email Sign In Form */
            <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="login-member-email"
                  className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5c5852] dark:text-[#b8b8b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-member-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[46px] pl-10 pr-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-member-name"
                  className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1.5"
                >
                  Display Name (optional)
                </label>
                <input
                  id="login-member-name"
                  type="text"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full min-h-[46px] px-3.5 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[46px] px-5 rounded-lg text-sm font-semibold cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
              >
                {busy ? 'Signing in...' : 'Continue'}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
