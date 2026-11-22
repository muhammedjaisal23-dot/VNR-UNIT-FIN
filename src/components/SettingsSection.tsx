import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Copy, Download, ExternalLink, Eye, EyeOff, Globe, KeyRound, Lock, Upload } from 'lucide-react';
import type { AdminAuthInfo, CommitteeMember, DatabaseSnapshot, OrgMeta } from '../types';
import { parseBackupFile } from '../utils/localBackup';
import { ConfirmButton } from './ConfirmButton';

interface SettingsSectionProps {
  org: OrgMeta;
  committee: CommitteeMember[];
  customExpenseCategories: string[];
  customIncomeCategories: string[];
  adminAuth?: AdminAuthInfo;
  onSaveOrg: (payload: { orgName: string; openingBalance: number }) => Promise<void>;
  onUpdateAdminCredentials: (payload: {
    currentPassword: string;
    username: string;
    newPassword?: string;
  }) => Promise<void>;
  onAddCommitteeMember: (name: string) => Promise<void>;
  onDeleteCommitteeMember: (id: string) => Promise<void>;
  onAddCustomCategory: (type: 'income' | 'expense', name: string) => Promise<string>;
  onDeleteCustomCategory: (type: 'income' | 'expense', name: string) => Promise<void>;
  onTogglePublicView: (enabled: boolean) => Promise<void>;
  onOpenPublicView: () => void;
  onDownloadBackup: () => void;
  onRestoreBackup: (snapshot: DatabaseSnapshot) => Promise<void>;
  onOpenShareModal: () => void;
}

export function SettingsSection({
  org,
  committee,
  customExpenseCategories,
  customIncomeCategories,
  adminAuth,
  onSaveOrg,
  onUpdateAdminCredentials,
  onAddCommitteeMember,
  onDeleteCommitteeMember,
  onAddCustomCategory,
  onDeleteCustomCategory,
  onTogglePublicView,
  onOpenPublicView,
  onDownloadBackup,
  onRestoreBackup,
  onOpenShareModal,
}: SettingsSectionProps) {
  const [orgName, setOrgName] = useState(org.orgName);
  const [openingBalance, setOpeningBalance] = useState(String(org.openingBalance));
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgMsg, setOrgMsg] = useState<string | null>(null);
  const [orgErr, setOrgErr] = useState<string | null>(null);

  const [adminUsername, setAdminUsername] = useState(adminAuth?.username || 'admin');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCredPasswords, setShowCredPasswords] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsMsg, setCredsMsg] = useState<string | null>(null);
  const [credsErr, setCredsErr] = useState<string | null>(null);

  const [memberName, setMemberName] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberErr, setMemberErr] = useState<string | null>(null);

  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catName, setCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [catErr, setCatErr] = useState<string | null>(null);

  const [togglingPublic, setTogglingPublic] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [fallbackPublicLink, setFallbackPublicLink] = useState<string | null>(null);

  const [restoring, setRestoring] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupErr, setBackupErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const publicViewEnabled = org.publicViewEnabled !== false;
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

  useEffect(() => {
    setOrgName(org.orgName);
    setOpeningBalance(String(org.openingBalance));
  }, [org.orgName, org.openingBalance]);

  useEffect(() => {
    if (adminAuth?.username) {
      setAdminUsername(adminAuth.username);
    }
  }, [adminAuth?.username]);

  const handleSaveAdminCreds = async (e: FormEvent) => {
    e.preventDefault();
    setCredsErr(null);
    setCredsMsg(null);

    const cleanUser = adminUsername.trim();
    if (cleanUser.length < 3 || cleanUser.length > 40) {
      setCredsErr('Username must be between 3 and 40 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9._@-]+$/.test(cleanUser)) {
      setCredsErr('Username can only contain letters, numbers, dots, underscores, hyphens, or @.');
      return;
    }
    if (!currentPassword) {
      setCredsErr('Enter your current admin password to save changes.');
      return;
    }
    if (newPassword.length > 0) {
      if (newPassword.length < 6) {
        setCredsErr('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setCredsErr('New password and confirmation do not match.');
        return;
      }
    }

    setSavingCreds(true);
    try {
      await onUpdateAdminCredentials({
        currentPassword,
        username: cleanUser,
        ...(newPassword.length > 0 ? { newPassword } : {}),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setCredsMsg(
        newPassword.length > 0
          ? 'Admin username and password updated.'
          : 'Admin username updated.'
      );
      setTimeout(() => setCredsMsg(null), 4000);
    } catch (err) {
      setCredsErr(err instanceof Error ? err.message : 'Failed to update admin credentials.');
    } finally {
      setSavingCreds(false);
    }
  };

  const handleSaveOrg = async (e: FormEvent) => {
    e.preventDefault();
    setOrgErr(null);
    setOrgMsg(null);
    const parsed = Number(openingBalance);
    if (!orgName.trim()) {
      setOrgErr('Organisation name cannot be empty.');
      return;
    }
    if (!Number.isFinite(parsed)) {
      setOrgErr('Opening balance must be a valid number.');
      return;
    }
    setSavingOrg(true);
    try {
      await onSaveOrg({ orgName: orgName.trim(), openingBalance: parsed });
      setOrgMsg('Organisation details saved.');
      setTimeout(() => setOrgMsg(null), 3000);
    } catch (err) {
      setOrgErr(err instanceof Error ? err.message : 'Failed to save organisation details.');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    setMemberErr(null);
    if (!memberName.trim()) {
      setMemberErr('Enter a committee member name.');
      return;
    }
    setAddingMember(true);
    try {
      await onAddCommitteeMember(memberName.trim());
      setMemberName('');
    } catch (err) {
      setMemberErr(err instanceof Error ? err.message : 'Failed to add member.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    setCatErr(null);
    const cleaned = catName.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setCatErr('Enter a category name.');
      return;
    }
    setAddingCat(true);
    try {
      await onAddCustomCategory(catType, cleaned);
      setCatName('');
    } catch (err) {
      setCatErr(err instanceof Error ? err.message : 'Failed to add category.');
    } finally {
      setAddingCat(false);
    }
  };

  const handleRestoreFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBackupErr(null);
    setBackupMsg(null);
    setRestoring(true);
    try {
      const text = await file.text();
      const snapshot = parseBackupFile(text);
      await onRestoreBackup(snapshot);
      setBackupMsg('Backup restored successfully.');
      setTimeout(() => setBackupMsg(null), 4000);
    } catch (err) {
      setBackupErr(err instanceof Error ? err.message : 'Could not restore backup file.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Organisation & Opening Balance */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
          Organisation Settings
        </h2>
        <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
          Used across the ledger header, CSV downloads, and PDF financial reports.
        </p>

        {orgErr && (
          <div className="mt-3 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5]">
            {orgErr}
          </div>
        )}
        {orgMsg && (
          <div className="mt-3 p-3 rounded-lg bg-[#ecfdf3] dark:bg-[#132a1c] border border-[#bbf7d0] dark:border-[#1f4d30] text-sm text-[#15803d] dark:text-[#4ade80]">
            {orgMsg}
          </div>
        )}

        <form onSubmit={handleSaveOrg} className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6">
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Organisation name
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
              Opening balance (₹)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="font-num w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={savingOrg}
              className="w-full min-h-[44px] px-5 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
            >
              {savingOrg ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      </section>

      {/* Admin Panel Login (Username & Password) */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#ff4f00] dark:text-[#ffc400]" />
              <span>Admin Panel Login</span>
            </h2>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              Manage the username and password required to open the Finance Admin Panel.
            </p>
          </div>
          {adminAuth && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#d94300] dark:text-[#ffc400] bg-[#fff3eb] dark:bg-[#262626] border border-[#ffc9ad] dark:border-[#3f3f3f] rounded-md px-2.5 py-1 self-start shrink-0">
              <Lock className="w-3.5 h-3.5" />
              <span>Username: {adminAuth.username}</span>
            </span>
          )}
        </div>

        {adminAuth?.envConfigured ? (
          <div className="mt-4 p-3.5 rounded-lg bg-[#fff3eb] dark:bg-[#262626] border border-[#ffc9ad] dark:border-[#ff4f00]/45 text-xs sm:text-sm text-[#1c1c1c] dark:text-[#ffffff]">
            Admin credentials are currently controlled by server environment secrets (
            <span className="font-num font-semibold">ADMIN_USERNAME</span> /{' '}
            <span className="font-num font-semibold">ADMIN_PASSWORD</span>). Update those secrets to change the Admin login.
          </div>
        ) : (
          <>
            {credsErr && (
              <div className="mt-3 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5]">
                {credsErr}
              </div>
            )}
            {credsMsg && (
              <div className="mt-3 p-3 rounded-lg bg-[#ecfdf3] dark:bg-[#132a1c] border border-[#bbf7d0] dark:border-[#1f4d30] text-sm text-[#15803d] dark:text-[#4ade80]">
                {credsMsg}
              </div>
            )}

            <form onSubmit={handleSaveAdminCreds} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                    Admin username
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    autoComplete="username"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                    Current password (required)
                  </label>
                  <div className="relative">
                    <input
                      type={showCredPasswords ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full min-h-[44px] pl-3 pr-11 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCredPasswords((p) => !p)}
                      aria-label={showCredPasswords ? 'Hide passwords' : 'Show passwords'}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-[#5c5852] dark:text-[#b8b8b8] cursor-pointer"
                    >
                      {showCredPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                    New password (optional)
                  </label>
                  <input
                    type={showCredPasswords ? 'text' : 'password'}
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5c5852] dark:text-[#b8b8b8] mb-1">
                    Confirm new password
                  </label>
                  <input
                    type={showCredPasswords ? 'text' : 'password'}
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    disabled={newPassword.length === 0}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400] disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={savingCreds}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
                >
                  {savingCreds ? 'Updating...' : 'Update Admin Credentials'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {/* Committee Members */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
          Committee Members
        </h2>
        <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
          Names added here appear in the “Borrowed from” dropdown under Loans and are tagged as Committee. Only visible to the finance admin.
        </p>

        {memberErr && (
          <div className="mt-3 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5]">
            {memberErr}
          </div>
        )}

        <form onSubmit={handleAddMember} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            maxLength={100}
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Committee member full name"
            className="flex-1 min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
          />
          <button
            type="submit"
            disabled={addingMember}
            className="min-h-[44px] px-5 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
          >
            {addingMember ? 'Adding...' : 'Add member'}
          </button>
        </form>

        {committee.length === 0 ? (
          <div className="mt-4 py-8 px-4 text-center rounded-lg border border-dashed border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3]/60 dark:bg-[#121212]/50 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
            No committee members added yet.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-[#efeae2] dark:divide-[#303030] border border-[#e6e2da] dark:border-[#303030] rounded-lg">
            {committee.map((member) => (
              <li
                key={member.id}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <span className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff] break-words min-w-0">
                  {member.name}
                </span>
                <ConfirmButton
                  label="Remove"
                  confirmLabel="Confirm remove"
                  onConfirm={() => onDeleteCommitteeMember(member.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Custom Categories (Expense & Income) */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
              Custom Categories
            </h2>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              Categories added under “Other” (or added here) appear in the Expense and Income dropdowns.
            </p>
          </div>

          <div className="inline-flex p-1 rounded-lg bg-[#f1eee9] dark:bg-[#121212] border border-[#e6e2da] dark:border-[#303030] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setCatType('expense');
                setCatErr(null);
              }}
              className={`min-h-[40px] px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                catType === 'expense'
                  ? 'bg-[#ff4f00] text-[#ffffff] dark:bg-[#ff6b2b] dark:text-[#1c1c1c]'
                  : 'text-[#5c5852] dark:text-[#b8b8b8]'
              }`}
            >
              Expense ({customExpenseCategories.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setCatType('income');
                setCatErr(null);
              }}
              className={`min-h-[40px] px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                catType === 'income'
                  ? 'bg-[#15803d] text-[#ffffff] dark:bg-[#22c55e] dark:text-[#1c1c1c]'
                  : 'text-[#5c5852] dark:text-[#b8b8b8]'
              }`}
            >
              Income ({customIncomeCategories.length})
            </button>
          </div>
        </div>

        {catErr && (
          <div className="mt-3 p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5]">
            {catErr}
          </div>
        )}

        <form onSubmit={handleAddCategory} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            maxLength={60}
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder={
              catType === 'expense'
                ? 'Add custom expense category (e.g. Electricity)'
                : 'Add custom income category (e.g. Sponsorship)'
            }
            className="flex-1 min-h-[44px] px-3 rounded-lg border border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3] dark:bg-[#121212] text-sm text-[#1c1c1c] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#ff4f00] dark:focus:ring-[#ffc400]"
          />
          <button
            type="submit"
            disabled={addingCat}
            className="min-h-[44px] px-5 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] disabled:opacity-50 transition-colors"
          >
            {addingCat ? 'Adding...' : 'Add category'}
          </button>
        </form>

        {(catType === 'expense' ? customExpenseCategories : customIncomeCategories).length === 0 ? (
          <div className="mt-4 py-6 px-4 text-center rounded-lg border border-dashed border-[#d6d1c7] dark:border-[#3f3f3f] bg-[#f7f6f3]/60 dark:bg-[#121212]/50 text-xs text-[#5c5852] dark:text-[#b8b8b8]">
            No custom {catType} categories added yet.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-[#efeae2] dark:divide-[#303030] border border-[#e6e2da] dark:border-[#303030] rounded-lg">
            {(catType === 'expense' ? customExpenseCategories : customIncomeCategories).map(
              (cat) => (
                <li key={cat} className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#1c1c1c] dark:text-[#ffffff] break-words min-w-0">
                    {cat}
                  </span>
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Confirm remove"
                    onConfirm={() => onDeleteCustomCategory(catType, cat)}
                  />
                </li>
              )
            )}
          </ul>
        )}
      </section>

      {/* Public View */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#ff4f00] dark:text-[#ffc400]" />
              <span>Public View</span>
            </h2>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              Allow anyone with the Public View link to see the read-only financial summary, programmes, ledger, and charts. Loans and committee members are always hidden.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={publicViewEnabled}
            disabled={togglingPublic}
            onClick={async () => {
              setTogglingPublic(true);
              try {
                await onTogglePublicView(!publicViewEnabled);
              } finally {
                setTogglingPublic(false);
              }
            }}
            className={`min-h-[44px] px-4 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors disabled:opacity-50 ${
              publicViewEnabled
                ? 'bg-[#ff4f00] text-[#ffffff] dark:bg-[#ffc400] dark:text-[#1c1c1c]'
                : 'border border-[#d6d1c7] dark:border-[#303030] bg-[#f7f6f3] dark:bg-[#121212] text-[#5c5852] dark:text-[#b8b8b8]'
            }`}
          >
            {publicViewEnabled ? 'Public View: ON' : 'Public View: OFF'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPublicLink}
            disabled={!publicViewEnabled}
            className="min-h-[44px] px-4 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {copiedPublicLink ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>Public link copied</span>
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
            onClick={onOpenPublicView}
            className="min-h-[44px] px-4 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer border border-[#d6d1c7] dark:border-[#303030] text-[#1c1c1c] dark:text-[#ffffff] hover:bg-[#ebe7e0] dark:hover:bg-[#262626] transition-colors"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>Open Public View</span>
          </button>
        </div>

        {fallbackPublicLink && (
          <div className="space-y-1">
            <label className="block text-xs text-[#5c5852] dark:text-[#b8b8b8]">
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
      </section>

      {/* Data Backup & Restore */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
              Data Backup & Restore
            </h2>
            <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
              Your accounts are automatically saved in this browser and restored after server restarts. Download a backup file to keep a copy or move to another device.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDownloadBackup}
              className="min-h-[44px] px-4 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer bg-[#ff4f00] text-[#ffffff] hover:bg-[#e04500] dark:bg-[#ffc400] dark:text-[#1c1c1c] dark:hover:bg-[#ffcf33] transition-colors"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download backup</span>
            </button>
            <button
              type="button"
              disabled={restoring}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 inline-flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626] disabled:opacity-50 transition-colors"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>{restoring ? 'Restoring...' : 'Restore backup'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreFileChange}
              className="hidden"
            />
          </div>
        </div>

        {backupErr && (
          <div className="p-3 rounded-lg bg-[#fef2f2] dark:bg-[#2c1515] border border-[#fecaca] dark:border-[#612424] text-sm text-[#b91c1c] dark:text-[#fca5a5]">
            {backupErr}
          </div>
        )}
        {backupMsg && (
          <div className="p-3 rounded-lg bg-[#ecfdf3] dark:bg-[#132a1c] border border-[#bbf7d0] dark:border-[#1f4d30] text-sm text-[#15803d] dark:text-[#4ade80]">
            {backupMsg}
          </div>
        )}
      </section>

      {/* Access shortcut */}
      <section className="rounded-xl bg-[#ffffff] dark:bg-[#1c1c1c] border border-[#e6e2da] dark:border-[#303030] p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1c1c1c] dark:text-[#ffffff]">
            Secretaries & View-Only Access
          </h2>
          <p className="text-xs text-[#5c5852] dark:text-[#b8b8b8] mt-1">
            Invite programme secretaries by email or manage who has view-only access.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenShareModal}
          className="min-h-[44px] px-5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer border border-[#ff4f00] text-[#d94300] hover:bg-[#fff3eb] dark:border-[#ffc400] dark:text-[#ffc400] dark:hover:bg-[#262626] transition-colors"
        >
          Manage Share & Access
        </button>
      </section>
    </div>
  );
}
