// ============================================================
// feedbackApi.js — user feedback, bug reports & admin review
// ============================================================

import { apiJson, jsonBody } from "./http";

function query(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── User endpoints ────────────────────────────────────────────

export const submitFeedback = ({ category = "FEEDBACK", subject = "", message = "", pageContext = "" }) =>
  apiJson("/api/feedback", jsonBody("POST", { category, subject, message, pageContext }));

export const getMyFeedback = () => apiJson("/api/feedback/mine");

// ── Admin endpoints ───────────────────────────────────────────

export const adminGetFeedback = ({ status = "", category = "", search = "", page = 0, size = 20 } = {}) =>
  apiJson(`/api/admin/feedback${query({ status, category, search: search.trim(), page, size })}`);

export const adminUpdateFeedback = (id, changes) =>
  apiJson(`/api/admin/feedback/${id}`, jsonBody("PATCH", changes));

export const adminDeleteFeedback = (id) =>
  apiJson(`/api/admin/feedback/${id}`, { method: "DELETE" });

export const adminGetFeedbackSettings = () =>
  apiJson("/api/admin/feedback/settings");

export const adminSaveFeedbackSettings = (alertEmail) =>
  apiJson("/api/admin/feedback/settings", jsonBody("PUT", { alertEmail }));

