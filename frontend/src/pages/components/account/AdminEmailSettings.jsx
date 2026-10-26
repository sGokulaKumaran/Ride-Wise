// ============================================================
// AdminEmailSettings — Manage admin Gmail & Google App Password
//
// Allows RideWise platform admins to configure:
//   1. Destination & sender Gmail address
//   2. 16-character Google App Password (saved securely to platform_settings)
//   3. "Send Test Email" to verify credentials immediately with Google SMTP
//
// Mounted in:
//   - Settings.jsx (under Admin: Mail & Feedback Alerts)
//   - AdminFeedback.jsx (/admin/feedback)
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
          ? `Alert email saved to ${cleanEmail}${cleanPassword ? " with new app password." : "."}`
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
      toast.info("Saved app password removed.");
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
      toast.warn("Please enter a Gmail address first.");
      return;
    }

    setTesting(true);
    try {
      const payload = {};
      if (cleanEmail) payload.alertEmail = cleanEmail;
      if (cleanPassword) payload.appPassword = cleanPassword;

      const res = await adminTestFeedbackEmail(payload);
      toast.success(res.message || "Test email sent successfully! Check your inbox.");
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
            <h2 className="text-sm font-bold">Feedback email & Gmail alerts</h2>
            {isSmtpConfigured ? (
              <Badge tone="ok" tc={tc}>
                Active: auto-forwarding
              </Badge>
            ) : hasSavedPassword ? (
              <Badge tone="warn" tc={tc}>
                SMTP verifying
              </Badge>
            ) : (
              <Badge tone="sub" tc={tc}>
                App password needed
              </Badge>
            )}
          </div>
          <p className={`mt-0.5 text-xs ${tc.sub}`}>
            Forward user feedback and bug reports to your Gmail address instantly without editing server files.
          </p>
        </div>

        {data.alertEmail && (
          <span className={`text-xs font-mono font-medium ${tc.sub}`}>
            {data.alertEmail}
          </span>
        )}
      </div>

      {/* ── Form Inputs ── */}
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Gmail Address */}
          <Field
            label="Admin Gmail address"
            hint="Receives all feedback submissions & bug alerts"
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

          {/* Google App Password */}
          <Field
            label="Google App Password (16 chars)"
            hint={
              hasSavedPassword
                ? "Password configured. Enter a new one only to update."
                : "Generated at myaccount.google.com/apppasswords"
            }
            tc={tc}
          >
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
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

        {/* ── Helper guide ── */}
        <div className={`rounded-lg border p-3 text-xs ${tc.card} ${tc.divider}`}>
          <div className="flex items-start gap-2">
            <Icon name="info" size={14} className={`mt-0.5 shrink-0 ${tc.sub}`} />
            <div className={`space-y-1 ${tc.sub}`}>
              <p>
                To generate your 16-character code: open your Google Account &gt; <strong>Security</strong> &gt;{" "}
                <strong>2-Step Verification</strong> &gt; <strong>App passwords</strong>. Name it <em>RideWise</em> and paste the code here.
              </p>
              <p>
                Once configured, user bug reports and feedback will be automatically emailed to you with the user&apos;s email in the <em>Reply-To</em> header.
              </p>
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon="check"
              tc={tc}
              loading={saving}
            >
              Save settings
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              icon="mail"
              tc={tc}
              loading={testing}
              onClick={handleTestEmail}
              disabled={!emailInput.trim() && !data.alertEmail}
            >
              Send test email
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
