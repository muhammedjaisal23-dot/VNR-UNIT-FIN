import { useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, Eye, EyeOff, Globe, KeyRound, LogOut, Mail, UserCheck, X } from 'lucide-react';
import type { AuthUser, ManagedUser } from '../types';
import { ConfirmButton } from './ConfirmButton';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  users?: ManagedUser[];
  publicViewEnabled: boolean;
  onTogglePublicView: (enabled: boolean) => Promise<void>;
  onOpenPublicView: () => void;
  onAdminLogin: (username: string, password: string) => Promise<void>;
  onSwitchAccount: (email: string, name?: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onInviteUser: (payload: {
    email: string;
    name: string;
    role: 'secretary' | 'viewer';
  }) => Promise<void>;
  onRemoveUser: (id: string) => Promise<void>;
}

export function AccountModal({
  open,
  onClose,
  currentUser,
  users = [],
  publicViewEnabled,
  onTogglePublicView,
  onOpenPublicView,
  onAdminLogin,
  onSwitchAccount,
  onLogout,
  onInviteUser,
  onRemoveUser,
}: AccountModalProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'secretary' | 'viewer'>('secretary');
  const [switchMode, setSwitchMode] = useState<'admin' | 'email'>('admin');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [switchEmail, setSwitchEmail] = useState('');
  const [switchName, setSwitchName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [fallbackPublicLink, setFallbackPublicLink] = useState<string | null>(null);

  if (!open) return null;

  const isAdmin = currentUser.role === 'admin';
  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}#public`
      : '#public';

  const handleCopyPublicLink = async () => {
    setFallbackPublicLink(null);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(publicUrl);
        setCopiedPublicLink(true);
        setTimeout(() => setCopiedPublicLink(false), 2500);
        return;
      }
      throw new Error('Clipboard unavailable');
    } catch {
      setFallbackPublicLink(publicUrl);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setError('Enter a valid email address to invite.');
      return;
    }
    setBusy(true);
    try {
      await onInviteUser({
        email: inviteEmail.trim(),
        name: inviteName.trim() || inviteEmail.trim().split('@')[0],
        role: inviteRole,
      });
      setNotice(`Invited ${inviteEmail.trim()} as ${inviteRole === 'secretary' ? 'Secretary' : 'View-only'}.`);
      setInviteEmail('');
      setInviteName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSwitch = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!adminUsername.trim() || !adminPassword) {
      setError('Enter both Admin username and password.');
      return;
    }
    setBusy(true);
    try {
      await onAdminLogin(adminUsername.trim(), adminPassword);
      setAdminUsername('');
      setAdminPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid Admin username or password.');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitch = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!switchEmail.trim() || !switchEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await onSwitchAccount(switchEmail.trim(), switchName.trim() || undefined);
      setSwitchEmail('');
      setSwitchName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in with that email.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await onLogout();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const roleLabel =
    currentUser.role === 'admin'
      ? 'Finance Admin'
      : currentUser.role === 'secretary'
        ? 'Secretary'
        : 'View-only';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#121212]/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Share and account access"
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-5 sm:p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#efeae2] dark:border-[#303030]">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
              {isAdmin ? 'Share & Access' : 'Account Access'}
            </h2>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1 break-words">
              Signed in as <span className="font-medium text-[#1c1c1c] dark:text-[#ffffff]">{currentUser.name}</span> ({currentUser.email}) · {roleLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={handleSignOut}
              className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold border border-[#fecaca] dark:border-[#612424] text-[#b91c1c] dark:text-[#f87171] hover:bg-[#fef2f2] dark:hover:bg-[#2c1515] cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign out</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-[#d6d1c7] dark:border-[#303030] text-[#5c5852] dark:text-[#b8b8b8] hover:bg-[#ebe7e0] dark:hover:bg-[#262626] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5] break-words">
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-4 p-3 rounded-lg bg-[#ecfdf3] dark:bg-[#132a1c] border border-[#bbf7d0] dark:border-[#1f4d30] text-sm text-[#15803d] dark:text-[#4ade80] break-words">
            {notice}
          </div>
        )}

        {isAdmin && (
          <div className="mt-5 pb-5 border-b border-[#efeae2] dark:border-[#303030] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#1c1c1c] dark:text-[#ffffff] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#ff4f00] dark:text-[#ffc400]" />
                  <span>Public View</span>
                </h3>
                <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
                  Share a read-only link for members to view balance, programmes, ledger, and charts. Loans and committee members stay private.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={publicViewEnabled}
                disabled={busy}
                onClick={async () => {
                  setError(null);
                  setBusy(true);
                  try {
                    await onTogglePublicView(!publicViewEnabled);
                    setNotice(
                      !publicViewEnabled
                        ? 'Public View enabled.'
                        : 'Public View disabled.'
                    );
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not update Public View.');
                  } finally {
                    setBusy(false);
                  }
                }}
                className={`min-h-[44px] px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors disabled:opacity-50 ${
                  publicViewEnabled
                    ? 'bg-[#ff4f00] text-[#ffffff] dark:bg-[#ffc400] dark:text-[#1c1c1c]'
                    : 'border border-[#d6d1c7] dark:border-[#303030] bg-[#f7f6f3] dark:bg-[#121212] text-[#5c5852] dark:text-[#b8b8b8]'
                }`}
              >
                {publicViewEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyPublicLink}
                disabled={!publicViewEnabled}
                className="min-h-[44px] px-3.5 inline-flex items-center gap-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {copiedPublicLink ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Link copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span>Copy public link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPublicView();
                }}
                className="min-h-[44px] px-3.5 inline-flex items-center gap-2 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer border border-[#d6d1c7] dark:border-[#303030] text-[#1c1c1c] dark:text-[#ffffff] hover:bg-[#ebe7e0] dark:hover:bg-[#262626] transition-colors"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>Preview Public View</span>
              </button>
            </div>

            {fallbackPublicLink && (
              <div className="space-y-1">
                <label className="block text-[11px] text-[#5c5852] dark:text-[#b8b8b8]">
                  Copy this public link manually:
                </label>
                <input
                  type="text"
                  readOnly
                  value={fallbackPublicLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-xs text-[#1c1c1c] dark:text-[#ffffff]"
                />
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="mt-5 pb-6 border-b border-[#e6e2da] dark:border-[#303030]">
            <h3 className="text-sm font-semibold text-[#1c1c1c] dark:text-[#ffffff] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#ff4f00] dark:text-[#ffc400]" />
              <span>Invite Secretary or Viewer by Email</span>
            </h3>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              Secretaries can only record expenses through a programme link you copy from Programmes. They never see loans or committee members.
            </p>

            <form onSubmit={handleInvite} className="mt-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="secretary@example.com"
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Rashid K."
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                    Access role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'secretary' | 'viewer')}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  >
                    <option value="secretary">Secretary (programme expenses only)</option>
                    <option value="viewer">View-only user</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save access'}
                </button>
              </div>
            </form>

            {users.length > 0 && (
              <div className="mt-5">
                <h4 className="text-xs font-semibold text-[#5c5852] dark:text-[#b8b8b8] mb-2">
                  People with access ({users.length})
                </h4>
                <div className="divide-y divide-[#efeae2] dark:divide-[#303030] border border-[#e6e2da] dark:border-[#303030] rounded-lg">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff] break-words">
                          {u.name}
                          <span className="ml-2 text-xs font-normal text-[#5c5852] dark:text-[#b8b8b8]">
                            · {u.role === 'admin' ? 'Finance Admin' : u.role === 'secretary' ? 'Secretary' : 'View-only'}
                          </span>
                        </div>
                        <div className="text-xs text-[#5c5852] dark:text-[#b8b8b8] break-all">
                          {u.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {u.id !== currentUser.id && (
                          <button
                            type="button"
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await onSwitchAccount(u.email);
                                onClose();
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="min-h-[44px] px-3 text-xs font-medium rounded-md border border-[#d6d1c7] dark:border-[#3f3f3f] text-[#1c1c1c] dark:text-[#ffffff] hover:bg-[#f1eee9] dark:hover:bg-[#262626] whitespace-nowrap cursor-pointer"
                          >
                            Switch to user
                          </button>
                        )}
                        {u.role !== 'admin' && (
                          <ConfirmButton
                            label="Revoke"
                            confirmLabel="Confirm revoke"
                            onConfirm={() => onRemoveUser(u.id)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Switch Account / Sign in */}
        <div className="mt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#1c1c1c] dark:text-[#ffffff] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#ff4f00] dark:text-[#ffc400]" />
              <span>{isAdmin ? 'Switch to Secretary / Viewer' : 'Sign in / Switch Account'}</span>
            </h3>

            {!isAdmin && (
              <div className="inline-flex p-1 rounded-lg bg-[#f1eee9] dark:bg-[#121212] border border-[#e6e2da] dark:border-[#303030] self-start">
                <button
                  type="button"
                  onClick={() => {
                    setSwitchMode('admin');
                    setError(null);
                  }}
                  className={`min-h-[38px] px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    switchMode === 'admin'
                      ? 'bg-[#ff4f00] text-[#ffffff] dark:bg-[#ffc400] dark:text-[#1c1c1c]'
                      : 'text-[#5c5852] dark:text-[#b8b8b8]'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Admin Panel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSwitchMode('email');
                    setError(null);
                  }}
                  className={`min-h-[38px] px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    switchMode === 'email'
                      ? 'bg-[#ff4f00] text-[#ffffff] dark:bg-[#ffc400] dark:text-[#1c1c1c]'
                      : 'text-[#5c5852] dark:text-[#b8b8b8]'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
              </div>
            )}
          </div>

          {!isAdmin && switchMode === 'admin' ? (
            <>
              <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
                Sign in with your Finance Admin username and password to open the full Admin Panel.
              </p>
              <form onSubmit={handleAdminSwitch} className="mt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                      Admin Username
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Enter admin username"
                      className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                      Admin Password
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter admin password"
                        className="w-full min-h-[44px] pl-3 pr-11 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword((p) => !p)}
                        aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-[#5c5852] dark:text-[#b8b8b8] cursor-pointer"
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50"
                >
                  {busy ? 'Signing in...' : 'Sign in to Admin Panel'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
                Enter an invited secretary or viewer email. (Switching away from Admin will require your Admin username and password to sign back in.)
              </p>

              <form onSubmit={handleSwitch} className="mt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={switchEmail}
                      onChange={(e) => setSwitchEmail(e.target.value)}
                      placeholder="secretary@example.com"
                      className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                      Your name (optional)
                    </label>
                    <input
                      type="text"
                      value={switchName}
                      onChange={(e) => setSwitchName(e.target.value)}
                      placeholder="Display name"
                      className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626] disabled:opacity-50"
                >
                  {busy ? 'Switching...' : 'Sign in with email'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
