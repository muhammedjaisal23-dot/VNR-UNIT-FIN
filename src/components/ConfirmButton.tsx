import { useEffect, useState } from 'react';

interface ConfirmButtonProps {
  label: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
  variant?: 'danger' | 'warning' | 'subtle';
  className?: string;
}

/**
 * Inline two-step confirmation button (no window.confirm dialogs).
 * Enforces >= 44px tap targets on mobile and desktop.
 */
export function ConfirmButton({
  label,
  confirmLabel = 'Confirm',
  onConfirm,
  disabled = false,
  variant = 'danger',
  className = '',
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(timer);
  }, [armed]);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setArmed(false);
    } finally {
      setBusy(false);
    }
  };

  if (armed) {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled || busy}
          className="min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer bg-[#dc2626] text-[#ffffff] hover:bg-[#b91c1c] dark:bg-[#ef4444] dark:text-[#ffffff] dark:hover:bg-[#f87171] disabled:opacity-50"
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={busy}
          className="min-h-[44px] px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer border border-[#d6d1c7] dark:border-[#303030] text-[#5c5852] dark:text-[#b8b8b8] hover:bg-[#ebe7e0] dark:hover:bg-[#262626]"
        >
          Cancel
        </button>
      </div>
    );
  }

  const baseStyles =
    variant === 'danger'
      ? 'text-[#b91c1c] dark:text-[#f87171] border border-[#fecaca] dark:border-[#612424] hover:bg-[#fef2f2] dark:hover:bg-[#2c1515]'
      : variant === 'warning'
        ? 'text-[#d94300] dark:text-[#ffc400] border border-[#ffc9ad] dark:border-[#5c470b] hover:bg-[#fff3eb] dark:hover:bg-[#262626]'
        : 'text-[#5c5852] dark:text-[#b8b8b8] border border-[#d6d1c7] dark:border-[#303030] hover:bg-[#ebe7e0] dark:hover:bg-[#262626]';

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      disabled={disabled}
      className={`min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${baseStyles} ${className}`}
    >
      {label}
    </button>
  );
}
