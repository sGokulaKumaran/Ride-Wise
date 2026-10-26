// ============================================================
// passwordStrength.js — the one strength scale for new passwords
// (sign-up form and Settings → change password)
//
//   passwordScore(password)  0–4: length, upper case, digit, symbol
//   PASSWORD_STRENGTH[score] { label, tone } — tone is a theme key
// ============================================================

export function passwordScore(password) {
  let score = 0;
  if (password.length > 5) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export const PASSWORD_STRENGTH = [
  { label: "Too short", tone: "danger" },
  { label: "Weak", tone: "danger" },
  { label: "Fair", tone: "warn" },
  { label: "Good", tone: "ok" },
  { label: "Strong", tone: "ok" },
];
