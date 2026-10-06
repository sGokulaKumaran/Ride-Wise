// ============================================================
// AdminAnnouncements — tell everyone following the organization
// (Announce tab)
//
// "Bus 4 starts twenty minutes late today." One message, and it reaches
//   • the organization's page, for whoever opens it
//   • a notification for every member and everyone who has the
//     organization on their list
//
// It can be about one vehicle (then the notification opens that vehicle's
// tracking screen) and it can take itself down after a while, so
// yesterday's delay is not still announced tomorrow.
// ============================================================

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useLoad } from "../../hooks/useFleet";
import Icon from "../../components/ui/Icon";
import Button, { Chip } from "../../components/ui/Button";
import {
  Badge, ConfirmButton, ErrorNote, Field, LoadError, Loading, Notice, Section, SelectInput, TextArea, TextInput,
} from "../../components/org/kit";
import { formatDateTime, parseTime } from "../../components/org/fleetUi";
import { getAnnouncements, getVehicles, postAnnouncement, removeAnnouncement } from "../../../services/orgApi";

const LEVELS = [
  { id: "INFO", label: "Information", icon: "megaphone", tone: "neutral" },
  { id: "WARNING", label: "Delay / change", icon: "alertTriangle", tone: "warn" },
  { id: "URGENT", label: "Urgent", icon: "alertCircle", tone: "danger" },
];

const EXPIRY = [
  { id: "0", label: "Until I remove it" },
  { id: "3", label: "For 3 hours" },
  { id: "12", label: "For 12 hours" },
  { id: "24", label: "For 1 day" },
  { id: "168", label: "For 1 week" },
];

export default function AdminAnnouncements({ org, orgId, tc }) {
  const list = useLoad(`admin-news-${orgId}`, () => getAnnouncements(orgId));
  const vehicles = useLoad(`admin-news-vehicles-${orgId}`, () => getVehicles(orgId));

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("INFO");
  const [vehicleId, setVehicleId] = useState("");
  const [expiry, setExpiry] = useState("24");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  const vehicleOptions = useMemo(() => [
    { id: "", label: "The whole organization" },
    ...(vehicles.data || [])
      .filter((vehicle) => vehicle.status !== "RETIRED")
      .map((vehicle) => ({ id: String(vehicle.id), label: vehicle.vehicleCode })),
  ], [vehicles.data]);

  const post = async (event) => {
    event.preventDefault();
    setError("");
    if (!title.trim() || !message.trim()) { setError("An announcement needs a title and a message."); return; }
    setPosting(true);
    try {
      await postAnnouncement(orgId, {
        title: title.trim(),
        message: message.trim(),
        level,
        vehicleId: vehicleId ? Number(vehicleId) : null,
        expiresInHours: Number(expiry) || null,
      });
      toast.success("Announced — everyone following the organization has been notified.");
      setTitle("");
      setMessage("");
      setLevel("INFO");
      setVehicleId("");
      list.reload();
    } catch (err) {
      setError(err.message || "Couldn't post the announcement.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (item) => {
    try {
      await removeAnnouncement(orgId, item.id);
      toast.info("Announcement removed.");
      list.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't remove it.");
    }
  };

  const suspended = org.card.status === "SUSPENDED";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ── Write one ── */}
      <Section title="New announcement" tc={tc}>
        <form onSubmit={post} className={`space-y-4 rounded-xl border p-4 ${tc.card}`} noValidate>
          <Field label="Title" tc={tc}>
            <TextInput tc={tc} value={title} onChange={(event) => setTitle(event.target.value)}
              placeholder="Route 4 starts late today" maxLength={120} disabled={suspended} />
          </Field>
          <Field label="Message" tc={tc} hint={`${message.length}/1000`}>
            <TextArea tc={tc} value={message} onChange={(event) => setMessage(event.target.value)}
              placeholder="The 7:30 bus leaves the depot at 7:50 because of road works on Main Street."
              maxLength={1000} rows={4} disabled={suspended} />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-semibold">Kind</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of announcement">
              {LEVELS.map((option) => (
                <Chip key={option.id} type="button" icon={option.icon} selected={level === option.id} tc={tc}
                  onClick={() => setLevel(option.id)}>
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="About" tc={tc}>
              <SelectInput tc={tc} options={vehicleOptions} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} />
            </Field>
            <Field label="Show it" tc={tc}>
              <SelectInput tc={tc} options={EXPIRY} value={expiry} onChange={(event) => setExpiry(event.target.value)} />
            </Field>
          </div>
          <ErrorNote message={error} tc={tc} />
          <Button type="submit" variant="primary" size="lg" full icon="megaphone" tc={tc} loading={posting} disabled={suspended}>
            Announce
          </Button>
          <p className={`flex items-start gap-2 text-xs ${tc.sub}`}>
            <Icon name="bell" size={13} className="mt-0.5" />
            Sent as a notification to your members and to everyone who has {org.card.name} on their list
            {org.accessCount > 0 ? ` (${org.accessCount} right now)` : ""}.
          </p>
        </form>
      </Section>

      {/* ── What is announced ── */}
      <Section title="Announced" count={list.data ? list.data.length : null} tc={tc}>
        {list.loading ? (
          <Loading tc={tc} compact />
        ) : !list.data ? (
          <LoadError error={list.error} onRetry={list.reload} tc={tc} />
        ) : list.data.length === 0 ? (
          <Notice icon="megaphone" title="Nothing announced" tc={tc} compact>
            Delays, route changes, holidays — what you announce appears on your organization&apos;s page.
          </Notice>
        ) : (
          <div className="space-y-2">
            {list.data.map((item) => {
              const info = LEVELS.find((option) => option.id === item.level) || LEVELS[0];
              const expires = parseTime(item.expiresAt);
              const expired = expires != null && expires < now;
              return (
                <article key={item.id} className={`rounded-xl border p-3.5 ${tc.card} ${expired ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold">{item.title}</span>
                        <Badge tone={info.tone} icon={info.icon} tc={tc}>{info.label}</Badge>
                        {item.vehicleCode && <Badge tc={tc}>{item.vehicleCode}</Badge>}
                        {expired && <Badge tc={tc}>No longer shown</Badge>}
                      </p>
                      <p className={`mt-1 whitespace-pre-line break-words text-sm ${tc.sub}`}>{item.message}</p>
                      <p className={`mt-1.5 text-[11px] ${tc.sub}`}>
                        {item.authorName} · {formatDateTime(item.createdAt)}
                        {expires != null && !expired ? ` · shown until ${formatDateTime(item.expiresAt)}` : ""}
                      </p>
                    </div>
                    <ConfirmButton label="Remove" confirmLabel="Remove" icon="trash" iconOnly variant="ghost" tc={tc}
                      title="Remove this announcement" onConfirm={() => remove(item)} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
