// ============================================================
// DeleteAccount — Settings → "Delete account" (the last section)
// ============================================================
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/AuthContext";
import { getDeleteCheck } from "../../../services/accountApi";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { Field, Loading, LoadError, Modal, TextInput } from "../org/kit";

const WHAT_GOES = [
  "Profile, connections & notifications",
  "Solo rides & ride history",
  "Organization memberships & alerts",
];

function DeleteDialog({ tc, onClose }) {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [check, setCheck] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDeleteCheck()
      .then((result) => { if (!cancelled) { setCheck(result); setLoadError(null); } })
      .catch((err) => { if (!cancelled) setLoadError(err); });
    return () => { cancelled = true; };
  }, [attempt]);

  const ready = check?.canDelete && password.length > 0 && confirm.trim() === "DELETE";

  const submit = async (event) => {
    event.preventDefault();
    if (!ready) return;
    setError("");
    setDeleting(true);
    try {
      await deleteAccount(password, confirm.trim());
      toast.success("Account deleted.");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't delete account.");
      setDeleting(false);
    }
  };

  const owned = check?.ownedOrganizations || [];

  return (
    <Modal
      title="Delete account"
      icon="trash"
      onClose={onClose}
      busy={deleting}
      tc={tc}
      footer={check?.canDelete ? (
        <>
          <Button variant="ghost" tc={tc} onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button type="submit" form="delete-account-form" variant="danger" icon="trash" tc={tc}
            loading={deleting} disabled={!ready}>
            Delete forever
          </Button>
        </>
      ) : (
        <Button variant="primary" tc={tc} onClick={onClose}>Close</Button>
      )}
    >
      {!check && !loadError && <Loading label="Checking account…" tc={tc} compact />}
      {loadError && <LoadError error={loadError} onRetry={() => setAttempt((n) => n + 1)} tc={tc} />}

      {check && !check.canDelete && (
        <div className="space-y-3 text-sm">
          {check.lastPlatformAdmin && (
            <p className={`rounded-lg border p-3 ${tc.dangerSoft}`}>
              You are the only RideWise admin. Promote another admin before deleting your account.
            </p>
          )}
          {owned.length > 0 && (
            <>
              <p>
                Transfer or delete {owned.length === 1 ? "your organization" : `your ${owned.length} organizations`} first:
              </p>
              <ul className={`divide-y rounded-lg border ${tc.divider}`}>
                {owned.map((org) => (
                  <li key={org.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      <Icon name="building" size={15} className={tc.sub} />
                      <span className="truncate">{org.name}</span>
                    </span>
                    <Link to={`/org-admin/${org.id}/people`} onClick={onClose}
                      className={`shrink-0 text-xs font-semibold hover:underline ${tc.accent}`}>
                      Manage
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {check?.canDelete && (
        <form id="delete-account-form" onSubmit={submit} noValidate className="space-y-4 text-sm">
          <p className={`rounded-lg border p-3 ${tc.dangerSoft}`}>
            Permanent action. Everything listed below will be erased:
          </p>
          <ul className="space-y-1.5">
            {WHAT_GOES.map((line) => (
              <li key={line} className="flex gap-2"><Icon name="close" size={15} className={`mt-0.5 shrink-0 ${tc.danger}`} />{line}</li>
            ))}
            {check.activeRides > 0 && (
              <li className="flex gap-2">
                <Icon name="ride" size={15} className={`mt-0.5 shrink-0 ${tc.sub}`} />
                {check.activeRides === 1 ? "Active ride ends" : `${check.activeRides} active rides end`}
              </li>
            )}
            {check.drivingNow && (
              <li className="flex gap-2">
                <Icon name="steering" size={15} className={`mt-0.5 shrink-0 ${tc.sub}`} />
                Active driver session ends
              </li>
            )}
          </ul>

          <Field label="Your password" tc={tc}>
            <TextInput tc={tc} type="password" value={password} onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password" autoFocus />
          </Field>
          <Field label="Type DELETE to confirm" tc={tc}>
            <TextInput tc={tc} value={confirm} onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="DELETE" />
          </Field>
          {error && <p role="alert" className={`text-xs ${tc.danger}`}>{error}</p>}
        </form>
      )}
    </Modal>
  );
}

export default function DeleteAccount({ tc }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tc.dangerSoft}`}>
            <Icon name="userOff" size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Remove account</p>
            <p className={`mt-0.5 text-xs ${tc.sub}`}>
              Permanently erase account &amp; all data
            </p>
          </div>
        </div>
        <Button variant="danger" size="sm" icon="trash" tc={tc} onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>
      {open && <DeleteDialog tc={tc} onClose={() => setOpen(false)} />}
    </>
  );
}
