// ============================================================
// SecuritySettings — Settings → "Account & security"
// ============================================================
import { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { changePassword, signOutOtherDevices } from "../../../services/accountApi";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { ConfirmButton, Field, TextInput } from "../org/kit";
import { PASSWORD_STRENGTH, passwordScore } from "../../../utils/passwordStrength";

const MIN_PASSWORD = 6;

// A password box with a show / hide button
function PasswordInput({ tc, value, onChange, autoComplete, placeholder, autoFocus = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <TextInput
        tc={tc}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? "Hide password" : "Show password"}
        className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center ${tc.sub}`}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={16} />
      </button>
    </div>
  );
}

// One line of the section: what it is, its current value, and its action
function Row({ icon, title, value, action, tc, children }) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.surface2}`}>
            <Icon name={icon} size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            {value && <p className={`truncate text-xs ${tc.sub}`}>{value}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmailForm({ tc, onDone }) {
  const { user, changeEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const next = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) { setError("Enter a valid email address."); return; }
    if (next === user?.email) { setError("That is already your email."); return; }
    if (!password) { setError("Enter your password to confirm."); return; }
    setSaving(true);
    try {
      await changeEmail(next, password);
      toast.success("Email updated.");
      onDone();
    } catch (err) {
      setError(err.message || "Couldn't change email.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={`mt-3 space-y-3 rounded-lg border p-3 ${tc.divider}`}>
      <Field label="New email" tc={tc}>
        <TextInput tc={tc} type="email" value={email} onChange={(event) => setEmail(event.target.value)}
          autoComplete="email" placeholder="you@example.com" autoFocus />
      </Field>
      <Field label="Current password" tc={tc}>
        <PasswordInput tc={tc} value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      {error && <p role="alert" className={`text-xs ${tc.danger}`}>{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" tc={tc} onClick={onDone} disabled={saving}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" icon="check" tc={tc} loading={saving}>Save</Button>
      </div>
    </form>
  );
}

function PasswordForm({ tc, onDone }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const score = passwordScore(next);
  const strength = PASSWORD_STRENGTH[score];

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!current) { setError("Enter your current password."); return; }
    if (next.length < MIN_PASSWORD) { setError(`Minimum ${MIN_PASSWORD} characters required.`); return; }
    if (next !== confirm) { setError("Passwords don't match."); return; }
    if (next === current) { setError("Choose a different password."); return; }
    setSaving(true);
    try {
      await changePassword(current, next);
      toast.success("Password updated. Other devices signed out.");
      onDone();
    } catch (err) {
      setError(err.message || "Couldn't change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={`mt-3 space-y-3 rounded-lg border p-3 ${tc.divider}`}>
      <Field label="Current password" tc={tc}>
        <PasswordInput tc={tc} value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
      </Field>
      <Field label="New password" tc={tc}>
        <PasswordInput tc={tc} value={next} onChange={setNext} autoComplete="new-password"
          placeholder={`Min ${MIN_PASSWORD} characters`} />
        {next && (
          <span className="mt-2 flex items-center gap-3">
            <span className="flex h-1 flex-1 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((level) => (
                <span key={level} className={`h-full flex-1 rounded-full ${level <= score ? `bg-current ${tc[strength.tone]}` : tc.hairline}`} />
              ))}
            </span>
            <span className={`text-xs font-medium ${tc[strength.tone]}`}>{strength.label}</span>
          </span>
        )}
      </Field>
      <Field label="Confirm password" tc={tc}>
        <PasswordInput tc={tc} value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>
      <p className={`text-xs ${tc.sub}`}>Signs out other devices automatically.</p>
      {error && <p role="alert" className={`text-xs ${tc.danger}`}>{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" tc={tc} onClick={onDone} disabled={saving}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" icon="check" tc={tc} loading={saving}>Update</Button>
      </div>
    </form>
  );
}

export default function SecuritySettings({ tc }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(null); // "email" | "password" | null

  const signOutOthers = async () => {
    try {
      await signOutOtherDevices();
      toast.success("Other devices signed out.");
    } catch (err) {
      toast.error(err.message || "Couldn't sign out other devices.");
    }
  };

  return (
    <>
      <Row
        icon="mail" title="Email" value={user?.email} tc={tc}
        action={open !== "email" && (
          <Button variant="secondary" size="sm" icon="edit" tc={tc} onClick={() => setOpen("email")}>Change</Button>
        )}
      >
        {open === "email" && <EmailForm tc={tc} onDone={() => setOpen(null)} />}
      </Row>

      <div className={`border-t ${tc.divider}`} />
      <Row
        icon="key" title="Password" value="Account login password" tc={tc}
        action={open !== "password" && (
          <Button variant="secondary" size="sm" icon="edit" tc={tc} onClick={() => setOpen("password")}>Change</Button>
        )}
      >
        {open === "password" && <PasswordForm tc={tc} onDone={() => setOpen(null)} />}
      </Row>

      <div className={`border-t ${tc.divider}`} />
      <Row
        icon="logout" title="Other devices" value="End sessions on other phones or browsers" tc={tc}
        action={(
          <ConfirmButton label="Sign out others" confirmLabel="Sign out" keepLabel="Cancel"
            icon="logout" variant="secondary" onConfirm={signOutOthers} tc={tc} />
        )}
      />
    </>
  );
}
