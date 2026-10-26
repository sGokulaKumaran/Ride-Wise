// ============================================================
// accountApi.js — the account settings that need the server
//
//   changePassword(current, next)   POST  /api/auth/password
//   changeEmail(email, password)    PATCH /api/auth/email          → user
//   signOutOtherDevices()           POST  /api/auth/sessions/sign-out-others
//   exportMyData()                  GET   /api/auth/account/export → JSON
//   getDeleteCheck()                GET   /api/auth/account/delete-check
//   deleteAccount(password, confirm) POST /api/auth/account/delete
//
// A wrong password comes back as 400 (not 401), so it never looks like
// "signed out". Changing the password and signing out other devices give
// THIS device a fresh session cookie; the browser stores it by itself.
// ============================================================

import { apiJson, jsonBody } from "./http";

export const changePassword = (currentPassword, newPassword) =>
  apiJson("/api/auth/password", jsonBody("POST", { currentPassword, newPassword }));

export const changeEmail = (email, password) =>
  apiJson("/api/auth/email", jsonBody("PATCH", { email: email.trim().toLowerCase(), password }));

export const signOutOtherDevices = () =>
  apiJson("/api/auth/sessions/sign-out-others", { method: "POST" });

export const exportMyData = () => apiJson("/api/auth/account/export");

export const getDeleteCheck = () => apiJson("/api/auth/account/delete-check");

export const deleteAccount = (password, confirm) =>
  apiJson("/api/auth/account/delete", jsonBody("POST", { password, confirm }));
