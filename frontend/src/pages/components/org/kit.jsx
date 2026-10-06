// ============================================================
// kit.jsx — the small building blocks of the organization screens
//
// Everything here follows the RideWise design system (see ui/Button.jsx
// and hooks/useTheme.js): monochrome surfaces, hairline borders, one
// accent, colour only where it carries meaning; rounded-lg controls,
// rounded-xl containers, rounded-full pills. Colours always come from
// the theme tokens (`tc`), so all four themes work without special cases.
//
//   AppShell      the page chrome (sidebar, top bar, bottom bar)
//   PageHeader    title, subtitle, back link, actions
//   Section       a titled block
//   Notice        empty / loading / error state
//   Badge         a small status pill
//   LiveDot       the pulsing "live" dot
//   StatCard      one number
//   TabStrip      pill tabs
//   Field · TextInput · SelectInput · TextArea · Toggle
//   Modal         bottom sheet on phones, dialog on larger screens
//   ConfirmButton a destructive action that asks once before acting
//   OrgAvatar     an organization's initials tile
// ============================================================

import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../layout/Sidebar";
import TopBar from "../layout/TopBar";
import MobileNav from "../layout/MobileNav";
import Icon from "../ui/Icon";
import Button, { IconButton } from "../ui/Button";
import { initials } from "./fleetUi";

// ── Page chrome ──────────────────────────────────────────────
export function AppShell({ tc, theme, setTheme, userId, width = "max-w-3xl", children }) {
  return (
    <div className={`relative min-h-screen w-full overflow-x-hidden ${tc.bg} ${tc.text}`}>
      <Sidebar tc={tc} />
      <TopBar theme={theme} setTheme={setTheme} tc={tc} userId={userId} />
      <MobileNav tc={tc} />
      <main className="px-4 pb-28 pt-24 lg:ml-64 lg:pb-12">
        <div className={`mx-auto w-full ${width}`}>{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, backTo, backLabel = "Back", actions = null, badges = null, tc }) {
  const navigate = useNavigate();
  const back = backTo ? (
    <button
      type="button"
      onClick={() => navigate(backTo)}
      className={`mb-2 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${tc.sub} hover:opacity-80`}
    >
      <Icon name="arrowLeft" size={14} />
      {backLabel}
    </button>
  ) : null;

  // No title: just the way back (the page draws its own heading).
  if (!title) return back ? <div className="mb-2">{back}</div> : null;

  return (
    <header className="mb-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
          {subtitle && <p className={`mt-1.5 text-sm ${tc.sub}`}>{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Section({ title, count = null, action = null, children, tc, className = "" }) {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={className}>
      {(title || action) && (
        <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
          <h2 id={id} className="flex items-center gap-2 text-sm font-semibold">
            {title}
            {count != null && <span className={`tabular-nums font-normal ${tc.sub}`}>{count}</span>}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ── States ───────────────────────────────────────────────────
export function Notice({ icon, title, children, tc, action = null, spin = false, compact = false }) {
  return (
    <div className={`rounded-xl border text-center ${compact ? "px-4 py-6" : "px-5 py-10"} ${tc.divider}`}>
      <Icon name={icon} size={compact ? 22 : 30} className={`mx-auto mb-3 ${spin ? "rw-spin" : ""} ${tc.sub}`} />
      <p className="text-sm font-semibold">{title}</p>
      {children && <p className={`mx-auto mt-1 max-w-sm text-xs ${tc.sub}`}>{children}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…", tc, compact = false }) {
  return <Notice icon="spinner" spin title={label} tc={tc} compact={compact} />;
}

/** What to show when a request failed: the server's own words and a way to retry. */
export function LoadError({ error, onRetry, tc }) {
  const forbidden = error?.status === 403;
  return (
    <Notice
      icon={forbidden ? "lock" : "alertTriangle"}
      title={forbidden ? "You can't open this" : "Couldn't load this"}
      tc={tc}
      action={onRetry && !forbidden ? (
        <Button variant="secondary" size="sm" icon="refresh" tc={tc} onClick={onRetry}>Try again</Button>
      ) : null}
    >
      {error?.message || "Please try again."}
    </Notice>
  );
}

export function ErrorNote({ message, tc }) {
  if (!message) return null;
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${tc.dangerSoft}`}>
      <Icon name="alertCircle" size={16} className="mt-0.5" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────
const TONE = {
  neutral: (tc) => `${tc.surface2} ${tc.divider} ${tc.sub}`,
  ok: (tc) => tc.okSoft,
  warn: (tc) => tc.warnSoft,
  danger: (tc) => tc.dangerSoft,
  accent: (tc) => tc.accentSoft,
  rejoin: (tc) => tc.rejoinSoft,
};

export function Badge({ tone = "neutral", icon, children, tc, className = "", title }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${(TONE[tone] || TONE.neutral)(tc)} ${className}`}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

const DOT = { ok: "bg-green-500", danger: "bg-red-500", warn: "bg-amber-500", neutral: "bg-gray-400" };

export function LiveDot({ tone = "ok", pulse = true }) {
  const color = DOT[tone] || DOT.ok;
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${color}`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export function StatCard({ icon, value, label, hint, tc, tone = null, loading = false }) {
  return (
    <div className={`rounded-xl border p-4 ${tc.card}`}>
      <Icon name={icon} size={18} className={tone ? tc[tone] : tc.sub} />
      <p className="mt-3 truncate text-xl font-bold tabular-nums">
        {loading ? <span className={`inline-block h-6 w-12 rounded ${tc.surface2}`} /> : value}
      </p>
      <p className={`mt-0.5 text-xs ${tc.sub}`}>{label}</p>
      {hint && <p className={`mt-0.5 truncate text-[11px] ${tc.sub} opacity-80`}>{hint}</p>}
    </div>
  );
}

export function OrgAvatar({ name, size = "md", tc }) {
  const box = { sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg font-bold ${box} ${tc.inkTile}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// ── Tabs ─────────────────────────────────────────────────────
export function TabStrip({ tabs, value, onChange, tc, label }) {
  return (
    <div role="tablist" aria-label={label} className={`mb-5 flex gap-1 rounded-full p-1 ${tc.surface2}`}>
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border px-2 text-sm font-semibold transition-colors ${
              selected ? tc.button : `border-transparent ${tc.navIdle}`
            }`}
          >
            {tab.icon && <Icon name={tab.icon} size={16} />}
            <span className="truncate">{tab.label}</span>
            {tab.count > 0 && <span className="tabular-nums opacity-70">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Forms ────────────────────────────────────────────────────
export function Field({ label, hint, error, tc, children, optional = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold">
        <span>{label}</span>
        {optional && <span className={`font-normal ${tc.sub}`}>Optional</span>}
      </span>
      {children}
      {error ? (
        <span className={`mt-1 block text-xs ${tc.danger}`}>{error}</span>
      ) : hint ? (
        <span className={`mt-1 block text-xs ${tc.sub}`}>{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL = "w-full rounded-lg border px-3 text-sm";

export function TextInput({ tc, className = "", ...rest }) {
  return <input className={`${CONTROL} h-11 ${tc.input} ${className}`} {...rest} />;
}

export function SelectInput({ tc, options, className = "", ...rest }) {
  return (
    <select className={`${CONTROL} h-11 ${tc.input} ${className}`} {...rest}>
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  );
}

export function TextArea({ tc, className = "", rows = 3, ...rest }) {
  return <textarea rows={rows} className={`${CONTROL} resize-y py-2.5 ${tc.input} ${className}`} {...rest} />;
}

export function Toggle({ checked, onChange, label, hint, tc, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${tc.card} ${tc.cardHover}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className={`mt-0.5 block text-xs ${tc.sub}`}>{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? tc.chipSelected : `${tc.surface2} ${tc.divider}`
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-current transition-[left] duration-200 ${
            checked ? "left-[22px]" : "left-0.5 opacity-50"
          }`}
        />
      </span>
    </button>
  );
}

/** A row of mutually exclusive choices, each with a title and a line of explanation. */
export function ChoiceCards({ options, value, onChange, tc, columns = 2 }) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`} role="radiogroup">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              selected ? tc.accentSoft : `${tc.card} ${tc.cardHover}`
            }`}
          >
            {option.icon && <Icon name={option.icon} size={18} className="mt-0.5" />}
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${selected ? "" : tc.text}`}>{option.label}</span>
              {option.hint && <span className={`mt-0.5 block text-xs ${selected ? "opacity-90" : tc.sub}`}>{option.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────
// A bottom sheet on phones, a centred dialog from 640 px. Closes on
// Escape and on a tap outside — unless `busy`, so a request in flight is
// never orphaned by a stray tap.
export function Modal({ title, icon, onClose, children, footer = null, tc, wide = false, busy = false }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape" && !busy) onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div
      className={`fixed inset-0 z-[8000] flex items-end justify-center sm:items-center sm:p-4 ${tc.overlay}`}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`rw-sheet flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl border border-b-0 sm:rounded-xl sm:border-b ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        } ${tc.card} ${tc.text}`}
      >
        <div className={`flex shrink-0 items-center gap-3 border-b px-4 py-3 ${tc.divider}`}>
          {icon && (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
              <Icon name={icon} size={18} />
            </span>
          )}
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h2>
          <IconButton icon="close" label="Close" size="sm" tc={tc} onClick={onClose} disabled={busy} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div
            className={`flex shrink-0 flex-wrap justify-end gap-2 border-t px-4 py-3 ${tc.divider}`}
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── A destructive action that asks once ──────────────────────
// First tap turns the button into "Keep · <confirm>"; nothing happens
// until the second, deliberate tap.
export function ConfirmButton({
  label, confirmLabel, keepLabel = "Keep", icon, onConfirm, tc,
  variant = "danger", size = "sm", iconOnly = false, title, disabled = false,
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  if (asking) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button variant="ghost" size={size} tc={tc} onClick={() => setAsking(false)} disabled={busy}>
          {keepLabel}
        </Button>
        <Button variant="danger" size={size} tc={tc} loading={busy} onClick={confirm}>
          {confirmLabel || label}
        </Button>
      </span>
    );
  }
  return (
    <Button
      variant={variant}
      size={size}
      icon={icon}
      iconOnly={iconOnly}
      title={title || label}
      tc={tc}
      disabled={disabled}
      onClick={() => setAsking(true)}
    >
      {label}
    </Button>
  );
}

// ── A status line floating over a map ────────────────────────
export function MapChip({ icon, tone = "neutral", spin = false, tc, children }) {
  const toneClass = {
    neutral: `${tc.card} ${tc.sub}`,
    ok: tc.okSoft,
    warn: tc.warnSoft,
    danger: tc.dangerSoft,
    rejoin: tc.rejoinSoft,
  }[tone];
  return (
    <div
      role="status"
      className={`pointer-events-auto mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm ${toneClass}`}
    >
      <Icon name={icon} size={15} className={spin ? "rw-spin" : ""} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

// ── One number in a row of numbers ───────────────────────────
export function Figure({ value, label, tc, strong = false }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className={`truncate font-bold tabular-nums ${strong ? "text-2xl" : "text-lg"}`}>{value}</p>
      <p className={`mt-0.5 text-[11px] uppercase tracking-wider ${tc.sub}`}>{label}</p>
    </div>
  );
}
