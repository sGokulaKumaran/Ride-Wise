// ============================================================
// AdminPeople — admins, drivers, viewers (People tab)
//
//   invite someone by username or email → they must accept
//   change a role, suspend, reactivate, remove
//   hand the ownership over (owner only)
//   for a private organization: who opened it with the password, and
//   taking that access away
//
// WHO MAY CHANGE WHOM (the server enforces it; the buttons follow it)
//   • the owner is changed only by handing the ownership over
//   • only the owner appoints, changes or removes admins
//   • admins manage drivers and viewers
//   • nobody changes their own membership here
//
// A driver who is removed or suspended in the middle of a trip: the trip
// ends at once and the vehicle is free again.
// ============================================================

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { useOrgs } from "../../../context/OrgContext";
import { useLoad } from "../../hooks/useFleet";
import Icon from "../../components/ui/Icon";
import Button from "../../components/ui/Button";
import {
  Badge, ChoiceCards, ConfirmButton, ErrorNote, Field, LiveDot, LoadError, Loading, Modal, Notice, Section,
  SelectInput, TextInput,
} from "../../components/org/kit";
import { ROLE_HINT, ROLE_LABEL, formatDay, parseTime, plural, timeAgo } from "../../components/org/fleetUi";
import {
  getAccessHolders, getMembers, inviteMember, removeMember, revokeAccess, transferOwnership, updateMember,
} from "../../../services/orgApi";

const ROLE_OPTIONS = [
  { id: "DRIVER", label: "Driver", icon: "steering", hint: ROLE_HINT.DRIVER },
  { id: "VIEWER", label: "Viewer", icon: "eye", hint: ROLE_HINT.VIEWER },
  { id: "ADMIN", label: "Admin", icon: "shield", hint: ROLE_HINT.ADMIN },
];

export default function AdminPeople({ org, orgId, tc, reloadOrg }) {
  const { user } = useAuth();
  const { refresh: refreshOrgs } = useOrgs();
  const members = useLoad(`admin-members-${orgId}`, () => getMembers(orgId));
  const isOwner = org.owner;
  const isPrivate = org.card.visibility === "PRIVATE";

  const [inviting, setInviting] = useState(false);
  const [managing, setManaging] = useState(null); // the member whose dialog is open

  const groups = useMemo(() => {
    const list = members.data || [];
    return {
      pending: list.filter((member) => member.status === "PENDING"),
      active: list.filter((member) => member.status === "ACTIVE"),
      suspended: list.filter((member) => member.status === "SUSPENDED"),
    };
  }, [members.data]);

  const withdraw = async (member) => {
    try {
      await removeMember(orgId, member.id);
      toast.info(`Invitation of @${member.username} withdrawn.`);
      members.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't withdraw the invitation.");
    }
  };

  if (members.loading) return <Loading label="Loading the people…" tc={tc} />;
  if (!members.data) return <LoadError error={members.error} onRetry={members.reload} tc={tc} />;

  return (
    <div className="space-y-8">
      {/* ── Invitations not answered yet ── */}
      {groups.pending.length > 0 && (
        <Section title="Invited — waiting for an answer" count={groups.pending.length} tc={tc}>
          <div className="space-y-2">
            {groups.pending.map((member) => (
              <div key={member.id} className={`flex items-center gap-3 rounded-xl border p-3.5 ${tc.card}`}>
                <Avatar name={member.username} tc={tc} muted />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">@{member.username}</p>
                  <p className={`truncate text-xs ${tc.sub}`}>
                    Invited as {ROLE_LABEL[member.role].toLowerCase()}
                    {member.invitedByName ? ` by ${member.invitedByName}` : ""} · {formatDay(member.invitedAt)}
                  </p>
                </div>
                <ConfirmButton label="Withdraw" confirmLabel="Withdraw" variant="ghost" tc={tc}
                  onConfirm={() => withdraw(member)} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Members ── */}
      <Section
        title="Members"
        count={groups.active.length}
        tc={tc}
        action={<Button variant="primary" size="sm" icon="userPlus" tc={tc} onClick={() => setInviting(true)}>Invite</Button>}
      >
        <div className="space-y-2">
          {groups.active.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              tc={tc}
              isMe={member.userId === user?.id}
              canManage={member.role !== "OWNER" && member.userId !== user?.id && (isOwner || member.role !== "ADMIN")}
              onManage={() => setManaging(member)}
            />
          ))}
        </div>
        {groups.active.length === 1 && groups.pending.length === 0 && (
          <Notice icon="userPlus" title="It's only you so far" tc={tc} compact
            action={<Button variant="primary" size="sm" icon="userPlus" tc={tc} onClick={() => setInviting(true)}>Invite a driver</Button>}>
            Invite your drivers by their RideWise username or email. They get a notification and choose to join.
          </Notice>
        )}
      </Section>

      {groups.suspended.length > 0 && (
        <Section title="Suspended" count={groups.suspended.length} tc={tc}>
          <div className="space-y-2">
            {groups.suspended.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                tc={tc}
                canManage={isOwner || member.role !== "ADMIN"}
                onManage={() => setManaging(member)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── People following the organization ── */}
      {isPrivate ? (
        <AccessHolders orgId={orgId} tc={tc} />
      ) : (
        <p className={`flex items-start gap-2 rounded-xl border p-3.5 text-xs ${tc.divider} ${tc.sub}`}>
          <Icon name="globe" size={14} className="mt-0.5" />
          This organization is public: anyone signed in to RideWise can follow its vehicles, so there is no list of
          people to manage here.{" "}
          {org.accessCount > 0
            ? `${plural(org.accessCount, "person", "people")} ${org.accessCount === 1 ? "has" : "have"} it on their list.`
            : ""}
        </p>
      )}

      {inviting && (
        <InviteModal
          tc={tc}
          orgId={orgId}
          orgName={org.card.name}
          isOwner={isOwner}
          onClose={() => setInviting(false)}
          onInvited={() => { setInviting(false); members.reload(); }}
        />
      )}
      {managing && (
        <ManageModal
          tc={tc}
          orgId={orgId}
          orgName={org.card.name}
          member={managing}
          isOwner={isOwner}
          onClose={() => setManaging(null)}
          onChanged={(ownershipMoved) => {
            setManaging(null);
            members.reload();
            if (ownershipMoved) { reloadOrg(); refreshOrgs(); }
          }}
        />
      )}
    </div>
  );
}

function Avatar({ name, tc, muted = false }) {
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${
      muted ? `border ${tc.surface2} ${tc.divider} ${tc.sub}` : tc.inkTile}`}>
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function MemberRow({ member, tc, isMe = false, canManage, onManage }) {
  const suspended = member.status === "SUSPENDED";
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3.5 ${tc.card} ${suspended ? "opacity-75" : ""}`}>
      <Avatar name={member.username} tc={tc} muted={suspended} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold">@{member.username}{isMe ? " (you)" : ""}</span>
          <Badge tone={member.role === "OWNER" || member.role === "ADMIN" ? "accent" : "neutral"}
            icon={member.role === "OWNER" ? "crown" : undefined} tc={tc}>
            {ROLE_LABEL[member.role]}
          </Badge>
          {member.onTrip && <Badge tone="ok" tc={tc}><LiveDot />Driving {member.tripVehicleCode}</Badge>}
          {suspended && <Badge tone="warn" tc={tc}>Suspended</Badge>}
        </p>
        <p className={`mt-0.5 flex flex-wrap items-center gap-x-3 text-xs ${tc.sub}`}>
          {member.email && <span className="truncate">{member.email}</span>}
          {member.mobile && (
            <a href={`tel:${member.mobile.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 hover:underline">
              <Icon name="phone" size={11} />{member.mobile}
            </a>
          )}
        </p>
      </div>
      {canManage && (
        <Button variant="ghost" size="sm" icon="more" iconOnly tc={tc} title={`Manage @${member.username}`} onClick={onManage} />
      )}
    </div>
  );
}

// ── Invite ───────────────────────────────────────────────────
function InviteModal({ tc, orgId, orgName, isOwner, onClose, onInvited }) {
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState("DRIVER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = isOwner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((option) => option.id !== "ADMIN");

  const send = async (event) => {
    event.preventDefault();
    setError("");
    if (!identifier.trim()) { setError("Enter their RideWise username or email."); return; }
    setBusy(true);
    try {
      const invited = await inviteMember(orgId, identifier.trim().replace(/^@/, ""), role);
      toast.success(`Invitation sent to @${invited.username}. They join when they accept it.`);
      onInvited();
    } catch (err) {
      setError(err.message || "Couldn't send the invitation.");
      setBusy(false);
    }
  };

  return (
    <Modal tc={tc} icon="userPlus" title={`Invite to ${orgName}`} onClose={onClose} busy={busy}>
      <form onSubmit={send} className="space-y-4" noValidate>
        <Field label="Username or email" tc={tc}
          hint="They need a RideWise account. Nothing happens until they accept — and only then do you see their contact details.">
          <TextInput tc={tc} value={identifier} onChange={(event) => setIdentifier(event.target.value)}
            placeholder="@arun  or  arun@example.com" autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={255} />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-semibold">As</p>
          <ChoiceCards options={options} value={role} onChange={setRole} tc={tc} columns={options.length} />
          {!isOwner && <p className={`mt-1.5 text-xs ${tc.sub}`}>Only the owner can invite admins.</p>}
        </div>
        <ErrorNote message={error} tc={tc} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" tc={tc} disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon="mail" tc={tc} loading={busy}>Send invitation</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Role · suspend · remove · hand over ──────────────────────
function ManageModal({ tc, orgId, orgName, member, isOwner, onClose, onChanged }) {
  const [role, setRole] = useState(member.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const suspended = member.status === "SUSPENDED";
  const roleOptions = (isOwner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((option) => option.id !== "ADMIN"))
    .map((option) => ({ id: option.id, label: `${option.label} — ${option.hint}` }));

  const run = async (action, done, ownershipMoved = false) => {
    setBusy(true);
    setError("");
    try {
      await action();
      toast.success(done);
      onChanged(ownershipMoved);
    } catch (err) {
      setError(err.message || "That didn't work. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal tc={tc} icon="user" title={`@${member.username}`} onClose={onClose} busy={busy}>
      <div className="space-y-5">
        <p className={`text-xs ${tc.sub}`}>
          {ROLE_LABEL[member.role]} of {orgName}
          {member.joinedAt ? ` since ${formatDay(member.joinedAt)}` : ""}
          {member.onTrip ? ` · driving ${member.tripVehicleCode} right now` : ""}
        </p>

        {!suspended && (
          <div className="space-y-2">
            <Field label="Role" tc={tc}>
              <SelectInput tc={tc} options={roleOptions} value={role} onChange={(event) => setRole(event.target.value)} />
            </Field>
            {role === "VIEWER" && member.onTrip && (
              <p className={`text-xs ${tc.warn}`}>A viewer cannot drive: the trip on {member.tripVehicleCode} will end.</p>
            )}
            <div className="flex justify-end">
              <Button variant="primary" size="sm" tc={tc} loading={busy} disabled={role === member.role}
                onClick={() => run(() => updateMember(orgId, member.id, { role }),
                  `@${member.username} is now ${ROLE_LABEL[role].toLowerCase()}.`)}>
                Change role
              </Button>
            </div>
          </div>
        )}

        <div className={`space-y-2 border-t pt-4 ${tc.divider}`}>
          {suspended ? (
            <ActionRow tc={tc} title="Reactivate" text="They can start trips and see the organization again.">
              <Button variant="secondary" size="sm" icon="check" tc={tc} disabled={busy}
                onClick={() => run(() => updateMember(orgId, member.id, { status: "ACTIVE" }), `@${member.username} is active again.`)}>
                Reactivate
              </Button>
            </ActionRow>
          ) : (
            <ActionRow tc={tc} title="Suspend"
              text={`Stays a member, but cannot start trips until reactivated.${member.onTrip ? " Their trip ends now." : ""}`}>
              <ConfirmButton label="Suspend" confirmLabel="Suspend" variant="secondary" icon="ban" tc={tc}
                onConfirm={() => run(() => updateMember(orgId, member.id, { status: "SUSPENDED" }), `@${member.username} suspended.`)} />
            </ActionRow>
          )}

          <ActionRow tc={tc} title="Remove from the organization"
            text={`They are told, and can be invited again later.${member.onTrip ? " Their trip ends now." : ""}`}>
            <ConfirmButton label="Remove" confirmLabel="Remove" icon="userMinus" tc={tc}
              onConfirm={() => run(() => removeMember(orgId, member.id), `@${member.username} removed.`)} />
          </ActionRow>

          {isOwner && !suspended && (
            <ActionRow tc={tc} title="Hand the ownership over"
              text={`@${member.username} becomes the owner of ${orgName}; you stay on as an admin. Only they can undo this.`}>
              <ConfirmButton label="Make owner" confirmLabel="Hand over" keepLabel="Keep it" variant="secondary" icon="crown" tc={tc}
                onConfirm={() => run(() => transferOwnership(orgId, member.id), `@${member.username} now owns ${orgName}.`, true)} />
            </ActionRow>
          )}
        </div>

        <ErrorNote message={error} tc={tc} />
      </div>
    </Modal>
  );
}

function ActionRow({ title, text, tc, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className={`text-xs ${tc.sub}`}>{text}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── A private organization: who holds access ─────────────────
function AccessHolders({ orgId, tc }) {
  const [page, setPage] = useState(0);
  const holders = useLoad(`admin-access-${orgId}-${page}`, () => getAccessHolders(orgId, page, 20));
  const [now] = useState(() => Date.now());

  const revoke = async (holder) => {
    try {
      await revokeAccess(orgId, holder.userId);
      toast.info(`@${holder.username} can no longer see your vehicles.`);
      holders.reload();
    } catch (err) {
      toast.error(err.message || "Couldn't remove the access.");
    }
  };

  return (
    <Section title="People who opened it with the password" count={holders.data ? holders.data.total : null} tc={tc}>
      {holders.loading ? (
        <Loading tc={tc} compact />
      ) : !holders.data ? (
        <LoadError error={holders.error} onRetry={holders.reload} tc={tc} />
      ) : holders.data.total === 0 ? (
        <Notice icon="key" title="Nobody yet" tc={tc} compact>
          Share your organization code and access password with the people who may follow your vehicles.
        </Notice>
      ) : (
        <>
          <div className="space-y-2">
            {holders.data.items.map((holder) => (
              <div key={holder.userId} className={`flex items-center gap-3 rounded-xl border p-3 ${tc.card}`}>
                <Avatar name={holder.username} tc={tc} muted />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">@{holder.username}</p>
                  <p className={`truncate text-xs ${tc.sub}`}>
                    Since {formatDay(holder.grantedAt)} · last opened {timeAgo(parseTime(holder.lastAccessedAt), now)}
                  </p>
                </div>
                <ConfirmButton label="Remove" confirmLabel="Remove access" variant="ghost" tc={tc} onConfirm={() => revoke(holder)} />
              </div>
            ))}
          </div>
          {holders.data.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" icon="chevronLeft" tc={tc} disabled={page === 0} onClick={() => setPage(page - 1)}>
                Newer
              </Button>
              <span className={`text-xs ${tc.sub}`}>Page {page + 1} of {holders.data.totalPages}</span>
              <Button variant="ghost" size="sm" icon="chevronRight" iconRight tc={tc}
                disabled={page + 1 >= holders.data.totalPages} onClick={() => setPage(page + 1)}>
                Older
              </Button>
            </div>
          )}
          <p className={`mt-3 text-xs ${tc.sub}`}>
            Removing someone does not change the password — they could enter it again. To lock everyone out, set a new
            password in Settings and choose &ldquo;everyone must enter it again&rdquo;.
          </p>
        </>
      )}
    </Section>
  );
}
