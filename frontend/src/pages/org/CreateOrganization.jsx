// ============================================================
// CreateOrganization — set up a new organization
// Route: /create-organization (protected)
//
// The person who creates it becomes its OWNER. Being an owner is a role
// inside this one organization — the account itself stays an ordinary
// RideWise account that can still ride, drive for someone else, or
// follow other organizations.
//
// PUBLIC or PRIVATE is the one decision that matters here:
//   Public    found by name; anyone signed in can follow its vehicles.
//   Private   never listed. People need its code AND an access password.
// Both can be changed later in the organization's settings.
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useOrgs } from "../../context/OrgContext";
import { useTheme } from "../hooks/useTheme";
import Button, { Chip } from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import {
  AppShell, ChoiceCards, ErrorNote, Field, PageHeader, TextArea, TextInput,
} from "../components/org/kit";
import { ORG_TYPES } from "../components/org/fleetUi";
import { createOrganization } from "../../services/orgApi";

const VISIBILITY = [
  { id: "PUBLIC",  icon: "globe", label: "Public",  hint: "Listed in search. Anyone signed in can follow your vehicles." },
  { id: "PRIVATE", icon: "lock",  label: "Private", hint: "Not listed. People need your code and an access password." },
];

export default function CreateOrganization() {
  const { user } = useAuth();
  const userId = user?.id;
  const { theme, setTheme, tc } = useTheme(userId);
  const navigate = useNavigate();
  const { refresh } = useOrgs();

  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("COLLEGE");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [accessPassword, setAccessPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPrivate = visibility === "PRIVATE";

  // Arrived here from "sign up for an organization": that wish is now
  // being fulfilled, so it must not send a later sign-up here again.
  useEffect(() => {
    try { sessionStorage.removeItem("ridewise-signup-intent"); } catch { /* storage unavailable */ }
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2) { setError("Give your organization a name."); return; }
    if (isPrivate && accessPassword.length < 6) {
      setError("A private organization needs an access password of at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const created = await createOrganization({
        name: name.trim(),
        orgType,
        visibility,
        accessPassword: isPrivate ? accessPassword : undefined,
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      refresh();
      toast.success(`${created.card.name} is ready.`);
      navigate(`/org-admin/${created.card.id}/dashboard`, { replace: true, state: { justCreated: true } });
    } catch (err) {
      setError(err.message || "Couldn't create the organization. Please try again.");
      setSaving(false);
    }
  };

  return (
    <AppShell tc={tc} theme={theme} setTheme={setTheme} userId={userId} width="max-w-2xl">
      <PageHeader
        tc={tc}
        title="New organization"
        subtitle="For a college, school, hospital, company or transport service that wants its vehicles on the map."
        backTo="/organizations"
        backLabel="Organizations"
      />

      <form onSubmit={submit} className="space-y-6" noValidate>
        <div className={`space-y-4 rounded-xl border p-4 ${tc.card}`}>
          <Field label="Name" tc={tc} hint="As people know it — this is what they will search for.">
            <TextInput
              tc={tc}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Riverside Engineering College"
              maxLength={80}
              autoFocus
            />
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-semibold">What kind of organization is it?</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Organization type">
              {ORG_TYPES.map((type) => (
                <Chip key={type.id} icon={type.icon} selected={orgType === type.id} tc={tc}
                  type="button" onClick={() => setOrgType(type.id)}>
                  {type.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <div className={`space-y-4 rounded-xl border p-4 ${tc.card}`}>
          <div>
            <p className="mb-1.5 text-xs font-semibold">Who can see your vehicles?</p>
            <ChoiceCards options={VISIBILITY} value={visibility} onChange={setVisibility} tc={tc} />
          </div>

          {isPrivate && (
            <Field
              label="Access password"
              tc={tc}
              hint="You share this (with the code you get after creating) with the people who may follow your vehicles. Your drivers and admins never need it."
            >
              <div className="relative">
                <TextInput
                  tc={tc}
                  type={showPassword ? "text" : "password"}
                  value={accessPassword}
                  onChange={(event) => setAccessPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  maxLength={64}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className={`absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full ${tc.sub}`}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            </Field>
          )}
        </div>

        <div className={`space-y-4 rounded-xl border p-4 ${tc.card}`}>
          <Field label="About" optional tc={tc}>
            <TextArea
              tc={tc}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="College buses for students and staff — eight routes across the city."
              maxLength={600}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" optional tc={tc}>
              <TextInput tc={tc} value={address} onChange={(event) => setAddress(event.target.value)}
                placeholder="Area, city" maxLength={255} />
            </Field>
            <Field label="Contact number" optional tc={tc} hint="Shown to people following your vehicles.">
              <TextInput tc={tc} type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)}
                placeholder="+91 98765 43210" maxLength={20} />
            </Field>
          </div>
        </div>

        <ErrorNote message={error} tc={tc} />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" tc={tc} onClick={() => navigate("/organizations")} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" size="lg" icon="building" tc={tc} loading={saving}>
            {saving ? "Creating…" : "Create organization"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
