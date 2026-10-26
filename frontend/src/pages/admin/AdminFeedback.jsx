// ============================================================
// AdminFeedback — Platform feedback, bug reports & Gmail forwarding
// Route: /admin/feedback (RideWise admins only)
//
//   1. Configure the admin Gmail address that receives feedback alerts
//   2. Filter & search user bug reports, feedback, feature requests & help
//   3. Update status (Open / Reviewed / Resolved), reply in-app (which
//      notifies the user), open/forward in Gmail, or delete entries
// ============================================================

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { useLoad } from "../hooks/useFleet";
import AdminLayout from "./AdminLayout";
import Icon from "../components/ui/Icon";
import Button, { Chip } from "../components/ui/Button";
import { Badge, ConfirmButton, Field, TextArea, TextInput } from "../components/org/kit";
import {
  adminDeleteFeedback,
  adminGetFeedback,
  adminGetFeedbackSettings,
  adminSaveFeedbackSettings,
  adminUpdateFeedback,
} from "../../services/feedbackApi";

const PAGE_SIZE = 15;

const STATUS_FILTERS = [
  { id: "",         label: "All" },
  { id: "OPEN",     label: "Open" },
  { id: "REVIEWED", label: "Reviewed" },
  { id: "RESOLVED", label: "Resolved" },
];

const CATEGORY_FILTERS = [
  { id: "",         label: "All types" },
  { id: "BUG",      label: "Bug reports" },
  { id: "FEEDBACK", label: "Feedback" },
  { id: "FEATURE",  label: "Features" },
  { id: "HELP",     label: "Help" },
];

const CATEGORY_META = {
  BUG:      { label: "Bug report",      icon: "alertTriangle", tone: "danger" },
  FEEDBACK: { label: "Feedback",        icon: "message",       tone: "accent" },
  FEATURE:  { label: "Feature request", icon: "idea",          tone: "ok" },
  HELP:     { label: "Help question",   icon: "help",          tone: "warn" },
};

const STATUS_META = {
  OPEN:     { label: "Open",     tone: "warn" },
  REVIEWED: { label: "Reviewed", tone: "accent" },
  RESOLVED: { label: "Resolved", tone: "ok" },
};

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function buildGmailComposeUrl({ to, subject, body }) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: to || "",
    su: subject || "",
    body: body || "",
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export default function AdminFeedback() {
  const { user } = useAuth();
  const { tc } = useTheme(user?.id);

  // ── Filter & pagination state ──
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // ── Admin Gmail setting state ──
  const settingsLoad = useLoad("admin-feedback-settings", adminGetFeedbackSettings);
  const [emailDraft, setEmailDraft] = useState(null);
  const [savingEmail, setSavingEmail] = useState(false);

  // ── Per-item reply / action state ──
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const list = useLoad(
    `admin-feedback-${status}-${category}-${search}-${page}`,
    () => adminGetFeedback({ status, category, search, page, size: PAGE_SIZE }),
  );
  const data = list.data;
  const savedEmail = settingsLoad.data?.alertEmail || "";
  const currentEmailInput = emailDraft !== null ? emailDraft : savedEmail;

  const handleSaveEmail = async (event) => {
    event.preventDefault();
    const next = currentEmailInput.trim().toLowerCase();
    setSavingEmail(true);
    try {
      const updated = await adminSaveFeedbackSettings(next);
      settingsLoad.setData(updated);
      setEmailDraft(null);
      toast.success(next ? `Feedback alerts set to ${next}` : "Forwarding email cleared.");
    } catch (err) {
      toast.error(err.message || "Couldn't save the Gmail address.");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdate = async (item, patch, successMsg) => {
    setBusyId(item.id);
    try {
      await adminUpdateFeedback(item.id, patch);
      toast.success(successMsg);
      setReplyingId(null);
      list.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't update feedback.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    try {
      await adminDeleteFeedback(id);
      toast.success("Feedback deleted.");
      list.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't delete feedback.");
    } finally {
      setBusyId(null);
    }
  };

  const openReplyBox = (item) => {
    if (replyingId === item.id) {
      setReplyingId(null);
      return;
    }
    setReplyingId(item.id);
    setReplyText(item.adminReply || "");
  };

  const forwardToAdminGmail = (item) => {
    const to = savedEmail || user?.email || "";
    const cat = (CATEGORY_META[item.category] || CATEGORY_META.FEEDBACK).label;
    const subject = `[RideWise ${cat}] ${item.subject}`;
    const lines = [
      `Category: ${cat}`,
      `From: ${item.username ? `@${item.username} ` : ""}<${item.userEmail || "unknown"}>`,
      item.pageContext ? `Screen: ${item.pageContext}` : null,
      `Submitted: ${formatDateTime(item.createdAt)}`,
      "",
      item.message,
    ].filter((l) => l !== null);
    window.open(buildGmailComposeUrl({ to, subject, body: lines.join("\n") }), "_blank", "noopener,noreferrer");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Feedback & Bug Reports</h1>
            <p className={`mt-1 text-sm ${tc.sub}`}>
              {data
                ? `${data.total} message${data.total === 1 ? "" : "s"} · ${data.openCount || 0} open`
                : "Loading feedback…"}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Icon name="search" size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.sub}`} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search user, subject, text…"
              aria-label="Search feedback"
              className={`w-full rounded-lg border py-2.5 pl-9 pr-4 text-sm ${tc.input}`}
            />
          </div>
        </div>

        {/* ── Admin Gmail Forwarding Card ── */}
        <section className={`rounded-xl border p-5 ${tc.card}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Icon name="mail" size={17} className={tc.sub} />
                <h2 className="text-sm font-bold">Admin Gmail for feedback alerts</h2>
                {savedEmail && <Badge tone="ok" tc={tc}>{savedEmail}</Badge>}
              </div>
              <p className={`mt-1 text-xs ${tc.sub}`}>
                Every user bug report or feedback item is delivered here, alerts your admin notification bell, and forwards to your Gmail address.
              </p>
            </div>

            <form onSubmit={handleSaveEmail} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <TextInput
                tc={tc}
                type="email"
                value={currentEmailInput}
                onChange={(event) => setEmailDraft(event.target.value)}
                placeholder="yourname@gmail.com"
                aria-label="Admin Gmail address"
                className="sm:w-72"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon="check"
                tc={tc}
                loading={savingEmail}
                disabled={emailDraft === null || currentEmailInput.trim().toLowerCase() === savedEmail}
              >
                Save Gmail
              </Button>
            </form>
          </div>
        </section>

        {/* ── Filter Strips ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const count =
                f.id === "OPEN" ? data?.openCount
                : f.id === "REVIEWED" ? data?.reviewedCount
                : f.id === "RESOLVED" ? data?.resolvedCount
                : null;
              return (
                <Chip
                  key={f.id || "all-status"}
                  selected={status === f.id}
                  onClick={() => { setStatus(f.id); setPage(0); }}
                  tc={tc}
                >
                  <span>{f.label}</span>
                  {count > 0 && <span className="tabular-nums opacity-75">({count})</span>}
                </Chip>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_FILTERS.map((f) => (
              <Chip
                key={f.id || "all-cat"}
                selected={category === f.id}
                onClick={() => { setCategory(f.id); setPage(0); }}
                tc={tc}
              >
                {f.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ── Error Banner ── */}
        {list.error && !data && (
          <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${tc.dangerSoft}`}>
            <Icon name="alertTriangle" size={16} />
            <span className="flex-1">{list.error.message}</span>
            <Button variant="secondary" size="sm" icon="refresh" tc={tc} onClick={list.reload}>
              Try again
            </Button>
          </div>
        )}

        {/* ── Feedback Items ── */}
        <div className="space-y-3">
          {list.loading && (
            <div className={`rounded-xl border py-12 text-center ${tc.card}`}>
              <span className="inline-flex items-center gap-2 text-sm">
                <Icon name="spinner" size={16} className="rw-spin" />
                <span className={tc.sub}>Loading feedback…</span>
              </span>
            </div>
          )}

          {!list.loading && data && data.items.length === 0 && (
            <div className={`rounded-xl border py-12 text-center ${tc.card} ${tc.sub}`}>
              <Icon name="message" size={28} className="mx-auto mb-3" />
              <p className="text-sm font-semibold">No feedback found</p>
              <p className="mt-1 text-xs">
                {search || status || category
                  ? "No messages match the current filters."
                  : "When riders submit feedback or bug reports, they will appear here."}
              </p>
            </div>
          )}

          {!list.loading && data?.items.map((item) => {
            const catMeta = CATEGORY_META[item.category] || CATEGORY_META.FEEDBACK;
            const statusMeta = STATUS_META[item.status] || STATUS_META.OPEN;
            const busy = busyId === item.id;
            const isReplying = replyingId === item.id;

            return (
              <article key={item.id} className={`rounded-xl border p-5 ${tc.card}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={catMeta.tone} icon={catMeta.icon} tc={tc}>
                        {catMeta.label}
                      </Badge>
                      <Badge tone={statusMeta.tone} tc={tc}>
                        {statusMeta.label}
                      </Badge>
                      <span className={`text-xs ${tc.sub}`}>
                        {item.username ? `@${item.username}` : "Rider"}
                        {item.userEmail ? ` · ${item.userEmail}` : ""}
                      </span>
                      {item.pageContext && (
                        <span className={`font-mono text-xs ${tc.sub}`}>· {item.pageContext}</span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-bold">{item.subject}</h3>
                  </div>

                  <span className={`shrink-0 text-xs ${tc.sub}`}>
                    {formatDateTime(item.createdAt)}
                  </span>
                </div>

                <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${tc.text}`}>
                  {item.message}
                </p>

                {item.adminReply && !isReplying && (
                  <div className={`mt-3 rounded-lg border px-3.5 py-2.5 text-xs ${tc.surface2} ${tc.divider}`}>
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Icon name="shield" size={13} className={tc.sub} />
                      <span>Admin reply</span>
                    </p>
                    <p className={`mt-1 whitespace-pre-wrap leading-relaxed ${tc.sub}`}>{item.adminReply}</p>
                  </div>
                )}

                {/* ── Action Bar ── */}
                <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 ${tc.divider}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.status !== "REVIEWED" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="eye"
                        tc={tc}
                        disabled={busy}
                        onClick={() => handleUpdate(item, { status: "REVIEWED" }, "Marked as reviewed.")}
                      >
                        Mark reviewed
                      </Button>
                    )}
                    {item.status !== "RESOLVED" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="checkCircle"
                        tc={tc}
                        disabled={busy}
                        onClick={() => handleUpdate(item, { status: "RESOLVED" }, "Marked as resolved.")}
                      >
                        Mark resolved
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="refresh"
                        tc={tc}
                        disabled={busy}
                        onClick={() => handleUpdate(item, { status: "OPEN" }, "Reopened.")}
                      >
                        Reopen
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      icon="message"
                      tc={tc}
                      disabled={busy}
                      onClick={() => openReplyBox(item)}
                    >
                      {item.adminReply ? "Edit reply" : "Reply"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      icon="mail"
                      tc={tc}
                      onClick={() => forwardToAdminGmail(item)}
                      title={savedEmail ? `Open in Gmail (${savedEmail})` : "Open in Gmail"}
                    >
                      Open in Gmail
                    </Button>
                  </div>

                  <ConfirmButton
                    label="Delete"
                    confirmLabel="Confirm delete"
                    icon="trash"
                    tc={tc}
                    disabled={busy}
                    onConfirm={() => handleDelete(item.id)}
                  />
                </div>

                {/* ── Inline Reply Editor ── */}
                {isReplying && (
                  <div className={`mt-3 space-y-2.5 rounded-lg border p-3 ${tc.divider}`}>
                    <Field
                      label="Reply to rider"
                      hint="Sends an in-app notification to the rider and appears under their message in Settings."
                      tc={tc}
                    >
                      <TextArea
                        tc={tc}
                        rows={3}
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Write a helpful response or status update…"
                        autoFocus
                      />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        tc={tc}
                        disabled={busy}
                        onClick={() => setReplyingId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon="check"
                        tc={tc}
                        loading={busy}
                        onClick={() =>
                          handleUpdate(
                            item,
                            {
                              adminReply: replyText.trim(),
                              status: item.status === "OPEN" ? "REVIEWED" : item.status,
                            },
                            "Reply saved and rider notified.",
                          )
                        }
                      >
                        Save reply
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* ── Pagination ── */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <span className={tc.sub}>
              Page {data.page + 1} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="chevronLeft"
                tc={tc}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                iconRight="chevronRight"
                tc={tc}
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

