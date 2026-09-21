// ============================================================
// 🔔 notificationApi.js — Notification data service
//
// All notification operations go through this file.
// Talks to the Spring Boot backend at /api/notifications.
//
// ENDPOINT MAP:
//   GET  /api/notifications?userId=           → getNotifications
//   GET  /api/notifications/unread-count?userId= → getUnreadCount
//   PATCH /api/notifications/{id}/read        → markAsRead
//   PATCH /api/notifications/read-all?userId=  → markAllAsRead
// ============================================================

const BASE = "/api/notifications";

export async function getNotifications(userId) {
  if (!userId) return [];
  try {
    const params = new URLSearchParams({ userId });
    const res = await fetch(`${BASE}?${params}`);
    if (!res.ok) throw new Error(`Get notifications failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[notificationApi] getNotifications failed:", err.message);
    return [];
  }
}

export async function getUnreadCount(userId) {
  if (!userId) return 0;
  try {
    const params = new URLSearchParams({ userId });
    const res = await fetch(`${BASE}/unread-count?${params}`);
    if (!res.ok) throw new Error(`Get unread count failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[notificationApi] getUnreadCount failed:", err.message);
    return 0;
  }
}

export async function markAsRead(notificationId) {
  if (!notificationId) return;
  try {
    await fetch(`${BASE}/${notificationId}/read`, {
      method: "PATCH",
    });
  } catch (err) {
    console.warn("[notificationApi] markAsRead failed:", err.message);
  }
}

export async function markAllAsRead(userId) {
  if (!userId) return;
  try {
    const params = new URLSearchParams({ userId });
    await fetch(`${BASE}/read-all?${params}`, {
      method: "PATCH",
    });
  } catch (err) {
    console.warn("[notificationApi] markAllAsRead failed:", err.message);
  }
}
