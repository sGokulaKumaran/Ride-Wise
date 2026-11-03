// ============================================================
// AdminEmailSettings — Manage admin Gmail & Google App Password
// ============================================================

import { useState } from "react";
import { toast } from "react-toastify";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { Badge, Field, TextInput } from "../org/kit";
import { useLoad } from "../../hooks/useFleet";
import {
  adminGetFeedbackSettings,
  adminSaveFeedbackSettings,
  adminTestFeedbackEmail,
} from "../../../services/feedbackApi";

export default function AdminEmailSettings({ tc }) {
  const settingsLoad = useLoad("admin-feedback-settings", adminGetFeedbackSettings);
  const data = settingsLoad.data || {};

  const [emailDraft, setEmailDraft] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const emailInput = emailDraft !== null ? emailDraft : (data.alertEmail || "");
  const hasSavedPassword = Boolean(data.hasAppPassword);
  const isSmtpConfigured = Boolean(data.smtpConfigured);

  const handleSave = async (event) => {
    if (event) event.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPassword = passwordInput.trim().replace(/\s+/g, "");

    setSaving(true);
    try {
      const payload = { alertEmail: cleanEmail };
      if (cleanPassword) {
        payload.appPassword = cleanPassword;
      }
      const updated = await adminSaveFeedbackSettings(payload);
      settingsLoad.setData(updated);
      setEmailDraft(null);
      setPasswordInput("");
      toast.success(
        cleanEmail
          ? `Alert email saved to ${cleanEmail}.`
          : "Email settings cleared."
      );
    } catch (err) {
      toast.error(err.message || "Couldn't save email settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearPassword = async () => {
    setSaving(true);
    try {
      const updated = await adminSaveFeedbackSettings({ clearPassword: true });
      settingsLoad.setData(updated);
      setPasswordInput("");
      toast.info("App password removed.");
    } catch (err) {
      toast.error(err.message || "Couldn't remove app password.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPassword = passwordInput.trim().replace(/\s+/g, "");

    if (!cleanEmail && !data.alertEmail) {
      toast.warn("Enter a Gmail address first.");
      return;
    }

    setTesting(true);
    try {
      const payload = {};
      if (cleanEmail) payload.alertEmail = cleanEmail;
      if (cleanPassword) payload.appPassword = cleanPassword;

      const res = await adminTestFeedbackEmail(payload);
      toast.success(res.message || "Test email sent.");
      settingsLoad.reload();
    } catch (err) {
      toast.error(err.message || "Failed to send test email.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header & Status Pill ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="mail" size={16} className={tc.sub} />
            <h2 className="text-base font-bold">Admin Gmail alerts</h2>
            {isSmtpConfigured ? (
              <Badge tone="ok" tc={tc}>Active</Badge>
            ) : hasSavedPassword ? (
              <Badge tone="warn" tc={tc}>Verifying</Badge>
            ) : (
              <Badge tone="sub" tc={tc}>Setup needed</Badge>
            )}
          </div>
          <p className={`mt-0.5 text-xs ${tc.sub}`}>
            Forward user bug reports &amp; feedback to Gmail.
          </p>
        </div>

        {data.alertEmail && (
          <span className={`text-xs font-mono font-medium ${tc.sub}`}>
            {data.alertEmail}
          </span>
        )}
      </div>

      {/* ── Form Inputs ── */}
      <form onSubmit={handleSave} className="space-y-3" autoComplete="off">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="Admin Gmail"
            hint="Receives feedback & bug alerts"
            tc={tc}
          >
            <TextInput
              tc={tc}
              type="email"
              value={emailInput}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="admin@gmail.com"
              aria-label="Admin Gmail address"
            />
          </Field>

          <Field
            label="Google App Password"
            hint={hasSavedPassword ? "Saved — enter new code to replace" : "16-char code from Google Security"}
            tc={tc}
          >
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoComplete="new-password"
                placeholder={hasSavedPassword ? "•••••••••••••••• (saved)" : "abcd efgh ijkl mnop"}
                aria-label="Google App Password"
                className={`w-full rounded-lg border py-2.5 pl-3.5 pr-10 text-sm font-mono tracking-wider ${tc.input}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 ${tc.sub} hover:${tc.text}`}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
              </button>
            </div>
          </Field>
        </div>

        {/* ── Compact Helper Note ── */}
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${tc.card} ${tc.divider} ${tc.sub}`}>
          <Icon name="key" size={14} className="shrink-0" />
          <span>Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App passwords.</span>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon="check"
              tc={tc}
              loading={saving}
            >
              Save
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="mail"
              tc={tc}
              loading={testing}
              onClick={handleTestEmail}
              disabled={!emailInput.trim() && !data.alertEmail}
            >
              Test email
            </Button>
          </div>

          {hasSavedPassword && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon="trash"
              tc={tc}
              disabled={saving}
              onClick={handleClearPassword}
              title="Remove stored app password"
            >
              Clear password
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
