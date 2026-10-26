// ============================================================
// HelpAndFeedback — Settings -> "Help & feedback"
//
//   1. Send feedback or report a bug (delivered to the RideWise admin
//      dashboard, admin notifications, and the admin's configured Gmail)
//   2. View your past submitted feedback and any admin replies
//   3. Quick answers to common questions about RideWise
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
  { id: "BUG",      label: "Bug report",      icon: "alertTriangle", hint: "Something broken or not working right" },
  { id: "FEEDBACK", label: "Feedback",        icon: "message",       hint: "General thoughts on RideWise" },
  { id: "FEATURE",  label: "Feature request", icon: "idea",          hint: "An idea or improvement you want" },
  { id: "HELP",     label: "Help question",   icon: "help",          hint: "Need help using a feature" },
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
    title: "Starting a solo or group ride",
    body: "Tap Start a Ride from Home or the center button on mobile. Choose your start and destination, pick one of the suggested routes, and choose Solo or Group. In a group ride, invited connections can share their live GPS position over WebSockets.",
  },
  {
    id: "navigation",
    icon: "route",
    title: "Turn-by-turn navigation & off-route rejoin",
    body: "During an active ride, RideWise tracks your progress along the blue route line and reads each turn aloud. If you leave the main route by more than 300 meters, a dashed purple rejoin line automatically guides you back to the nearest point ahead on the main route.",
  },
  {
    id: "organizations",
    icon: "building",
    title: "Following organization buses & fleet vehicles",
    body: "Open Organizations to search public organizations or unlock a private organization with its code and password. Select any live vehicle to watch its position, ETA, stop-by-stop progress, and set a proximity alert to be notified when it approaches your stop.",
  },
  {
    id: "driving",
    icon: "steering",
    title: "Driving for an organization",
    body: "If an organization admin grants you the Driver role, the Drive tab appears in your navigation. Pick an available vehicle and route to start a live session, update passenger crowd levels, or send an SOS alert to organization admins.",
  },
  {
    id: "privacy",
    icon: "shield",
    title: "Privacy, sessions & account control",
    body: "Your exact coordinates and phone number are never shown to other riders. You can hide your profile from search in Privacy settings, sign out other devices in Account & security, export all your data as JSON, or permanently delete your account at any time.",
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
      setError("Please enter at least a few words describing your feedback or issue.");
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
      toast.success("Sent to RideWise. Thank you for your feedback.");
      mine.reload();
      setShowMine(true);
    } catch (err) {
      setError(err.message || "Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5 pt-2">
      {/* ── 1. Send feedback or bug report ── */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <p className="text-xs font-semibold">What would you like to send?</p>
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
            placeholder={
              category === "BUG"
                ? "Short summary of the bug (for example, Map route didn't load)"
                : "Short summary"
            }
          />
        </Field>

        <Field label="Details" tc={tc}>
          <TextArea
            tc={tc}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={4000}
            placeholder={
              category === "BUG"
                ? "What happened, what screen you were on, and what you expected to happen…"
                : "Write your feedback, suggestion, or question…"
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
          <p className={`text-xs ${tc.sub}`}>
            Sent directly to the RideWise admin team with your account details.
          </p>
          <Button type="submit" variant="primary" size="sm" icon="mail" tc={tc} loading={sending}>
            {sending ? "Sending…" : "Send message"}
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
              <span>Your past messages</span>
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
                          <span>RideWise admin reply</span>
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

      {/* ── 3. Help & common questions ── */}
      <div className={`border-t pt-4 ${tc.divider}`}>
        <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <Icon name="help" size={16} className={tc.sub} />
          <span>Help & common questions</span>
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

