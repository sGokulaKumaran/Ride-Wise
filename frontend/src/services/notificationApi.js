// ============================================================
// notificationApi.js — in-app notifications
//
// ENDPOINTS:
//   GET   /api/notifications               → getNotifications (latest 50)
//   GET   /api/notifications/unread-count  → getUnreadCount
//   PATCH /api/notifications/{id}/read     → markAsRead
//   PATCH /api/notifications/read-all      → markAllAsRead
//
// The backend acts for the logged-in session. Notifications are a
// convenience, so these never throw: a failed call returns an empty
// result and the bell simply shows nothing new.
// ============================================================

import { apiJson } from "./http";

const BASE = "/api/notifications";

export async function getNotifications() {
  try {
    const list = await apiJson(BASE);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn("[notificationApi] getNotifications failed:", err.message);
    return [];
  }
}

export async function getUnreadCount() {
  try {
    const data = await apiJson(`${BASE}/unread-count`);
    return data?.count || 0;
  } catch (err) {
    console.warn("[notificationApi] getUnreadCount failed:", err.message);
    return 0;
  }
}

export async function markAsRead(notificationId) {
  if (!notificationId) return;
  try {
    await apiJson(`${BASE}/${notificationId}/read`, { method: "PATCH" });
  } catch (err) {
    console.warn("[notificationApi] markAsRead failed:", err.message);
  }
}

export async function markAllAsRead() {
  try {
    await apiJson(`${BASE}/read-all`, { method: "PATCH" });
  } catch (err) {
    console.warn("[notificationApi] markAllAsRead failed:", err.message);
  }
}
