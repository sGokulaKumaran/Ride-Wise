// ============================================================
// HelpAndFeedback — Settings -> "Help & feedback"
// ============================================================

import { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { useLoad } from "../../hooks/useFleet";
import { getMyFeedback, submitFeedback } from "../../../services/feedbackApi";
import Button, { Chip } from "../ui/Button";
import Icon from "../ui/Icon";
import { Badge, Field, TextArea, TextInput } from "../org/kit";

const CATEGORIES = [
  { id: "BUG",      label: "Bug",      icon: "alertTriangle", hint: "Report something broken" },
  { id: "FEEDBACK", label: "Feedback", icon: "message",       hint: "Share your thoughts" },
  { id: "FEATURE",  label: "Idea",     icon: "idea",          hint: "Request a new feature" },
  { id: "HELP",     label: "Help",     icon: "help",          hint: "Ask a question" },
];

const STATUS_META = {
  OPEN:     { label: "Open",     tone: "warn" },
  REVIEWED: { label: "Reviewed", tone: "accent" },
  RESOLVED: { label: "Resolved", tone: "ok" },
};

const HELP_TOPICS = [
  {
    id: "rides",
    icon: "ride",
    title: "Solo & group rides",
    body: "Tap New Ride from Home, pick your start and destination, choose a route, and select Solo or Group. Group ride members can share live GPS positions on the map.",
  },
  {
    id: "navigation",
    icon: "route",
    title: "Navigation & rerouting",
    body: "RideWise tracks your progress along the route and reads turns aloud. If you go off-route by 300 m, a dashed rejoin line guides you back automatically.",
  },
  {
    id: "organizations",
    icon: "building",
    title: "Organization fleets & buses",
    body: "Search public organizations or unlock private ones with a code and password. Follow live vehicles, view ETAs, and set stop proximity alerts.",
  },
  {
    id: "driving",
    icon: "steering",
    title: "Driver mode",
    body: "Drivers invited by an organization can start vehicle trips, update passenger crowd levels, and send SOS alerts to admins.",
  },
  {
    id: "privacy",
    icon: "shield",
    title: "Privacy & data control",
    body: "Your phone number and exact GPS are private. Toggle profile visibility, sign out other devices, export JSON data, or auto-delete completed rides anytime.",
  },
];

function formatShortDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function HelpAndFeedback({ tc }) {
  const { user } = useAuth();
  const [category, setCategory] = useState("FEEDBACK");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [openTopic, setOpenTopic] = useState(null);
  const [showMine, setShowMine] = useState(false);

  const mine = useLoad(user?.id != null ? `my-feedback-${user.id}` : null, getMyFeedback);
  const items = Array.isArray(mine.data) ? mine.data : [];

  const activeCategory = CATEGORIES.find((c) => c.id === category) || CATEGORIES[1];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    const trimmedMessage = message.trim();
    const trimmedSubject = subject.trim();

    if (trimmedMessage.length < 5) {
      setError("Please enter a short description.");
      return;
    }

    setSending(true);
    try {
      await submitFeedback({
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
        pageContext: window.location.pathname,
      });
      setSubject("");
      setMessage("");
      toast.success("Message sent to RideWise.");
      mine.reload();
      setShowMine(true);
    } catch (err) {
      setError(err.message || "Couldn't send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5 pt-2">
      {/* ── 1. Send feedback or bug report ── */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <p className="text-xs font-semibold">Category</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <Chip
                key={item.id}
                selected={category === item.id}
                onClick={() => setCategory(item.id)}
                tc={tc}
              >
                <Icon name={item.icon} size={14} />
                <span>{item.label}</span>
              </Chip>
            ))}
          </div>
          <p className={`mt-1.5 text-xs ${tc.sub}`}>{activeCategory.hint}</p>
        </div>

        <Field label="Subject" optional tc={tc}>
          <TextInput
            tc={tc}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={160}
            placeholder="Brief summary"
          />
        </Field>

        <Field label="Details" tc={tc}>
          <TextArea
            tc={tc}
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={4000}
            placeholder={
              category === "BUG"
                ? "What happened and which screen you were on…"
                : "Write your message…"
            }
          />
        </Field>

        {error && (
          <div role="alert" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tc.dangerSoft}`}>
            <Icon name="alertCircle" size={15} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className={`flex items-center gap-1.5 text-xs ${tc.sub}`}>
            <Icon name="shield" size={13} />
            <span>Sent directly to RideWise admins</span>
          </p>
          <Button type="submit" variant="primary" size="sm" icon="mail" tc={tc} loading={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>

      {/* ── 2. Rider's past submissions & admin replies ── */}
      {items.length > 0 && (
        <div className={`border-t pt-4 ${tc.divider}`}>
          <button
            type="button"
            onClick={() => setShowMine((open) => !open)}
            className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              <Icon name="history" size={16} className={tc.sub} />
              <span>Sent messages</span>
              <span className={`text-xs font-normal tabular-nums ${tc.sub}`}>({items.length})</span>
            </span>
            <Icon
              name="chevronDown"
              size={16}
              className={`transition-transform ${showMine ? "rotate-180" : ""} ${tc.sub}`}
            />
          </button>

          {showMine && (
            <div className="mt-3 space-y-2.5">
              {items.map((item) => {
                const statusMeta = STATUS_META[item.status] || STATUS_META.OPEN;
                const catMeta = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[1];
                return (
                  <div key={item.id} className={`rounded-lg border p-3 text-xs ${tc.divider}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold">
                        <Icon name={catMeta.icon} size={14} className={tc.sub} />
                        <span>{item.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={tc.sub}>{formatShortDate(item.createdAt)}</span>
                        <Badge tone={statusMeta.tone} tc={tc}>{statusMeta.label}</Badge>
                      </div>
                    </div>
                    <p className={`mt-1.5 whitespace-pre-wrap leading-relaxed ${tc.sub}`}>{item.message}</p>
                    {item.adminReply && (
                      <div className={`mt-2.5 rounded-lg border px-3 py-2 ${tc.surface2} ${tc.divider}`}>
                        <p className="flex items-center gap-1.5 font-semibold">
                          <Icon name="shield" size={13} className={tc.sub} />
                          <span>Admin reply</span>
                        </p>
                        <p className={`mt-1 whitespace-pre-wrap leading-relaxed ${tc.sub}`}>{item.adminReply}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 3. Quick Guide ── */}
      <div className={`border-t pt-4 ${tc.divider}`}>
        <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <Icon name="help" size={16} className={tc.sub} />
          <span>Quick guide</span>
        </p>
        <div className={`divide-y rounded-lg border ${tc.divider}`}>
          {HELP_TOPICS.map((topic) => {
            const expanded = openTopic === topic.id;
            return (
              <div key={topic.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenTopic(expanded ? null : topic.id)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-xs font-semibold transition-colors ${tc.cardHover}`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon name={topic.icon} size={15} className={tc.sub} />
                    <span>{topic.title}</span>
                  </span>
                  <Icon
                    name="chevronDown"
                    size={15}
                    className={`transition-transform ${expanded ? "rotate-180" : ""} ${tc.sub}`}
                  />
                </button>
                {expanded && (
                  <p className={`px-3.5 pb-3.5 pl-10 text-xs leading-relaxed ${tc.sub}`}>
                    {topic.body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
