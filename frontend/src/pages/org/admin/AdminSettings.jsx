// ============================================================
// AdminSettings — the organization itself (Settings tab)
//
//   Details     name, kind, description, address, contact number
//   Driving     a speed limit for the fleet · show drivers' phone numbers
//   Privacy     public or private · the access password
//   Danger      delete the organization
//
// Admins edit details and driving rules. Who can SEE the organization —
// public / private — and deleting it are the owner's decisions.
//
// Switching to private asks for a password and removes the organization
// from everybody who merely had it on their list (they never knew a
// password). Switching to public removes the password.
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useOrgs } from "../../../context/OrgContext";
import Icon from "../../components/ui/Icon";
import Button, { Chip } from "../../components/ui/Button";
import {
  ChoiceCards, ErrorNote, Field, Modal, Section, TextArea, TextInput, Toggle,
} from "../../components/org/kit";
import { ORG_TYPES, copyText } from "../../components/org/fleetUi";
import { deleteOrganization, setAccessPassword, updateOrganization } from "../../../services/orgApi";

const VISIBILITY = [
  { id: "PUBLIC",  icon: "globe", label: "Public",  hint: "Listed in search. Anyone signed in can follow your vehicles." },
  { id: "PRIVATE", icon: "lock",  label: "Private", hint: "Not listed. People need your code and the access password." },
];

export default function AdminSettings({ org, orgId, tc, reloadOrg, go }) {
  const navigate = useNavigate();
  const { refresh: refreshOrgs } = useOrgs();
  const card = org.card;
  const isOwner = org.owner;
  const isPrivate = card.visibility === "PRIVATE";

  // ── Details ──
  const [name, setName] = useState(card.name);
  const [orgType, setOrgType] = useState(card.orgType);
  const [description, setDescription] = useState(card.description || "");
  const [address, setAddress] = useState(card.address || "");
  const [contactPhone, setContactPhone] = useState(org.contactPhone || "");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const saveDetails = async (event) => {
    event.preventDefault();
    setDetailsError("");
    if (name.trim().length < 2) { setDetailsError("The organization needs a name."); return; }
    setSavingDetails(true);
    try {
      await updateOrganization(orgId, {
        name: name.trim(), orgType, description: description.trim(), address: address.trim(), contactPhone: contactPhone.trim(),
      });
      toast.success("Details saved.");
      reloadOrg();
      refreshOrgs();
    } catch (err) {
      setDetailsError(err.message || "Couldn't save the details.");
    } finally {
      setSavingDetails(false);
    }
  };

  // ── Driving rules (each saves on its own) ──
  const [limitText, setLimitText] = useState(org.speedLimitKmh ? String(org.speedLimitKmh) : "");
  const [savingRule, setSavingRule] = useState(null);

  const saveRule = async (key, changes, done) => {
    setSavingRule(key);
    try {
      await updateOrganization(orgId, changes);
      toast.success(done);
      reloadOrg();
    } catch (err) {
      toast.error(err.message || "Couldn't save that.");
    } finally {
      setSavingRule(null);
    }
  };

  const saveLimit = () => {
    const value = limitText.trim() === "" ? 0 : Number(limitText);
    if (!Number.isInteger(value) || (value !== 0 && (value < 10 || value > 160))) {
      toast.error("Enter a limit between 10 and 160 km/h, or leave it empty for none.");
      return;
    }
    saveRule("limit", { speedLimitKmh: value },
      value ? `Speed limit set to ${value} km/h — it applies to running trips at once.` : "Speed limit removed.");
  };

  const [dialog, setDialog] = useState(null); // "visibility" | "password" | "delete"
  const limitChanged = (limitText.trim() === "" ? null : Number(limitText)) !== (org.speedLimitKmh ?? null);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ── Details ── */}
      <Section title="Details" tc={tc}>
        <form onSubmit={saveDetails} className={`space-y-4 rounded-xl border p-4 ${tc.card}`} noValidate>
          <Field label="Name" tc={tc}>
            <TextInput tc={tc} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-semibold">Kind</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Organization type">
              {ORG_TYPES.map((type) => (
                <Chip key={type.id} type="button" icon={type.icon} selected={orgType === type.id} tc={tc}
                  onClick={() => setOrgType(type.id)}>
                  {type.label}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="About" optional tc={tc}>
            <TextArea tc={tc} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" optional tc={tc}>
              <TextInput tc={tc} value={address} onChange={(event) => setAddress(event.target.value)} maxLength={255} />
            </Field>
            <Field label="Contact number" optional tc={tc} hint="Shown to people following your vehicles.">
              <TextInput tc={tc} type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength={20} />
            </Field>
          </div>
          <ErrorNote message={detailsError} tc={tc} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" icon="check" tc={tc} loading={savingDetails}>Save details</Button>
          </div>
        </form>
      </Section>

      {/* ── Driving ── */}
      <Section title="Driving" tc={tc}>
        <div className="space-y-2">
          <div className={`rounded-xl border p-4 ${tc.card}`}>
            <p className="text-sm font-semibold">Speed limit for your vehicles</p>
            <p className={`mt-0.5 text-xs ${tc.sub}`}>
              Every time a driver passes it, the trip records it — you see it under Trips and Statistics, and the
              driver is warned on their screen. Leave empty for no limit.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative w-36">
                <TextInput tc={tc} type="number" inputMode="numeric" min={10} max={160} value={limitText}
                  onChange={(event) => setLimitText(event.target.value)} placeholder="None" className="pr-14"
                  aria-label="Speed limit in kilometres per hour" />
                <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs ${tc.sub}`}>km/h</span>
              </div>
              <Button variant="secondary" tc={tc} loading={savingRule === "limit"} disabled={!limitChanged} onClick={saveLimit}>
                Save
              </Button>
            </div>
          </div>

          <Toggle
            tc={tc}
            checked={org.showDriverPhone}
            disabled={savingRule === "phone"}
            onChange={(next) => saveRule("phone", { showDriverPhone: next },
              next ? "People following a vehicle can now call its driver." : "Drivers' numbers are hidden again.")}
            label="Show the driver's phone number to people following a vehicle"
            hint="Off: only your admins see drivers' numbers. Ask your drivers before switching this on."
          />
        </div>
      </Section>

      {/* ── Privacy ── */}
      <Section title="Who can see your vehicles" tc={tc}>
        <div className={`space-y-3 rounded-xl border p-4 ${tc.card}`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
              <Icon name={isPrivate ? "lock" : "globe"} size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{isPrivate ? "Private" : "Public"}</p>
              <p className={`text-xs ${tc.sub}`}>
                {isPrivate
                  ? "Not listed. People need your code and the access password."
                  : "Listed in search. Anyone signed in to RideWise can follow your vehicles."}
              </p>
            </div>
            <Button variant="secondary" size="sm" tc={tc} disabled={!isOwner}
              title={isOwner ? undefined : "Only the owner can change this"} onClick={() => setDialog("visibility")}>
              Change
            </Button>
          </div>

          <div className={`flex flex-wrap items-center gap-3 border-t pt-3 ${tc.divider}`}>
            <div className="min-w-0 flex-1">
              <p className={`text-xs ${tc.sub}`}>Organization code</p>
              <p className="font-mono text-lg font-bold tracking-widest">{card.orgCode}</p>
            </div>
            <Button variant="ghost" size="sm" icon="copy" tc={tc}
              onClick={async () => toast.info((await copyText(card.orgCode)) ? "Code copied." : `The code is ${card.orgCode}`)}>
              Copy
            </Button>
            {isPrivate && (
              <Button variant="secondary" size="sm" icon="key" tc={tc} onClick={() => setDialog("password")}>
                New password
              </Button>
            )}
          </div>

          {isPrivate && (
            <p className={`text-xs ${tc.sub}`}>
              {org.accessCount ?? 0} people have opened it with the password.{" "}
              <button type="button" className="font-semibold underline" onClick={() => go("people")}>See who</button>
            </p>
          )}
          {!isOwner && <p className={`text-xs ${tc.sub}`}>Only the owner can switch between public and private.</p>}
        </div>
      </Section>

      {/* ── Danger ── */}
      {isOwner && (
        <Section title="Delete" tc={tc}>
          <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${tc.dangerSoft}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Delete this organization</p>
              <p className="mt-0.5 text-xs opacity-90">
                Running trips end, and it disappears for your drivers and everyone following it. This cannot be undone.
              </p>
            </div>
            <Button variant="danger" icon="trash" tc={tc} onClick={() => setDialog("delete")}>Delete…</Button>
          </div>
        </Section>
      )}

      {dialog === "visibility" && (
        <VisibilityModal
          tc={tc}
          orgId={orgId}
          current={card.visibility}
          followers={org.accessCount ?? 0}
          onClose={() => setDialog(null)}
          onChanged={() => { setDialog(null); reloadOrg(); refreshOrgs(); }}
        />
      )}
      {dialog === "password" && (
        <PasswordModal tc={tc} orgId={orgId} onClose={() => setDialog(null)} onChanged={() => { setDialog(null); reloadOrg(); }} />
      )}
      {dialog === "delete" && (
        <DeleteModal
          tc={tc}
          orgId={orgId}
          name={card.name}
          onClose={() => setDialog(null)}
          onDeleted={() => { refreshOrgs(); navigate("/organizations", { replace: true }); }}
        />
      )}
    </div>
  );
}

function PasswordField({ tc, value, onChange, label = "Access password", hint, autoFocus = false }) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} tc={tc} hint={hint}>
      <div className="relative">
        <TextInput tc={tc} type={shown ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)}
          placeholder="At least 6 characters" autoComplete="new-password" maxLength={64} className="pr-11" autoFocus={autoFocus} />
        <button type="button" onClick={() => setShown((now) => !now)} aria-label={shown ? "Hide password" : "Show password"}
          className={`absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full ${tc.sub}`}>
          <Icon name={shown ? "eyeOff" : "eye"} size={16} />
        </button>
      </div>
    </Field>
  );
}

// ── Public ⇄ private ─────────────────────────────────────────
function VisibilityModal({ tc, orgId, current, followers, onClose, onChanged }) {
  const [visibility, setVisibility] = useState(current);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const goingPrivate = visibility === "PRIVATE" && current !== "PRIVATE";
  const goingPublic = visibility === "PUBLIC" && current !== "PUBLIC";

  const save = async () => {
    setError("");
    if (goingPrivate && password.length < 6) { setError("Choose an access password of at least 6 characters."); return; }
    setBusy(true);
    try {
      await updateOrganization(orgId, { visibility, accessPassword: goingPrivate ? password : undefined });
      toast.success(goingPrivate ? "The organization is private now." : "The organization is public now.");
      onChanged();
    } catch (err) {
      setError(err.message || "Couldn't change that.");
      setBusy(false);
    }
  };

  return (
    <Modal
      tc={tc}
      icon="eye"
      title="Who can see your vehicles"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" tc={tc} disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="primary" tc={tc} loading={busy} disabled={visibility === current} onClick={save}>
            {goingPrivate ? "Make private" : goingPublic ? "Make public" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ChoiceCards options={VISIBILITY} value={visibility} onChange={setVisibility} tc={tc} />
        {goingPrivate && (
          <>
            <PasswordField tc={tc} value={password} onChange={setPassword} autoFocus
              hint="Share it, with your code, with the people who may follow your vehicles. Drivers and admins never need it." />
            <p className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${tc.warnSoft}`}>
              <Icon name="alertTriangle" size={14} className="mt-0.5" />
              {followers > 0
                ? `${followers} people have this organization on their list. They lose it — and any "tell me when it's near" alerts — until they enter the password.`
                : "From now on nobody outside your members can see your vehicles without the password."}
            </p>
          </>
        )}
        {goingPublic && (
          <p className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${tc.warnSoft}`}>
            <Icon name="alertTriangle" size={14} className="mt-0.5" />
            Anyone signed in to RideWise will be able to find you by name and see where your vehicles are. The access
            password is removed.
          </p>
        )}
        <ErrorNote message={error} tc={tc} />
      </div>
    </Modal>
  );
}

// ── A new access password ────────────────────────────────────
function PasswordModal({ tc, orgId, onClose, onChanged }) {
  const [password, setPassword] = useState("");
  const [revoke, setRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (password.length < 6) { setError("Choose a password of at least 6 characters."); return; }
    setBusy(true);
    try {
      await setAccessPassword(orgId, password, revoke);
      toast.success(revoke
        ? "New password set. Everyone has to enter it again."
        : "New password set. People who already opened the organization keep their access.");
      onChanged();
    } catch (err) {
      setError(err.message || "Couldn't set the password.");
      setBusy(false);
    }
  };

  return (
    <Modal
      tc={tc}
      icon="key"
      title="New access password"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" tc={tc} disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" tc={tc} loading={busy} onClick={save}>Set password</Button>
        </>
      }
    >
      <div className="space-y-4">
        <PasswordField tc={tc} value={password} onChange={setPassword} label="New password" autoFocus
          hint="The old password stops working at once." />
        <Toggle
          tc={tc}
          checked={revoke}
          onChange={setRevoke}
          label="Everyone must enter it again"
          hint="Removes the access of everybody who opened the organization with the old password. Your drivers and admins are not affected."
        />
        <ErrorNote message={error} tc={tc} />
      </div>
    </Modal>
  );
}

// ── Delete, deliberately ─────────────────────────────────────
function DeleteModal({ tc, orgId, name, onClose, onDeleted }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteOrganization(orgId);
      toast.info(`${name} was deleted.`);
      onDeleted();
    } catch (err) {
      setError(err.message || "Couldn't delete the organization.");
      setBusy(false);
    }
  };

  return (
    <Modal
      tc={tc}
      icon="trash"
      title={`Delete ${name}?`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button variant="ghost" tc={tc} disabled={busy} onClick={onClose}>Keep it</Button>
          <Button variant="danger" icon="trash" tc={tc} loading={busy} disabled={!matches} onClick={remove}>
            Delete for good
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className={`text-sm ${tc.sub}`}>
          Every running trip ends now. Your drivers, your admins and everyone following the organization lose it
          immediately, and nobody can open it again. This cannot be undone.
        </p>
        <Field label={`Type the organization's name to confirm`} tc={tc}>
          <TextInput tc={tc} value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={name}
            autoComplete="off" autoFocus />
        </Field>
        <ErrorNote message={error} tc={tc} />
      </div>
    </Modal>
  );
}
