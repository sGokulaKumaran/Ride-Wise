// ============================================================
// useRideAssist.js — small helpers that make a ride hands-free
//
//   useVoiceGuidance(nav, enabled)   speaks the turn instructions
//   useWakeLock(active)              keeps the screen on while navigating
//   usePersistentFlag(key, initial)  an on/off choice that is remembered
//
// All three use standard browser APIs (Speech Synthesis, Screen Wake
// Lock, localStorage) — no dependency and no API key — and do nothing
// at all on a browser that lacks them.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { nextAnnouncement } from "../../services/navigation";

export const voiceSupported =
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

function speak(text) {
  if (!voiceSupported) return;
  const synth = window.speechSynthesis;
  // Something older is still waiting to be said → it is out of date now.
  if (synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const language = (navigator.language || "").toLowerCase();
  utterance.lang = language.startsWith("en") ? navigator.language : "en-US";
  utterance.rate = 1;
  synth.speak(utterance);
}

// ── Spoken turn-by-turn guidance ─────────────────────────────
// A rider cannot read a phone on the move. Each maneuver is announced
// ahead of time and again at the turn; leaving the route, getting back
// on it and arriving are announced too. WHAT to say is decided by the
// pure nextAnnouncement() in the navigation engine.
export function useVoiceGuidance(nav, enabled) {
  const memoRef = useRef(null);

  useEffect(() => {
    // The memo advances even while muted, so switching the voice back on
    // does not replay instructions that are already behind the rider.
    const { memo, say } = nextAnnouncement(memoRef.current, nav);
    memoRef.current = memo;
    if (say && enabled) speak(say);
  }, [nav, enabled]);

  // Muting stops the sentence in progress, not just future ones.
  useEffect(() => {
    if (!enabled && voiceSupported) window.speechSynthesis.cancel();
  }, [enabled]);

  useEffect(() => () => {
    if (voiceSupported) window.speechSynthesis.cancel();
  }, []);
}

// ── Keep the screen awake ────────────────────────────────────
// Without this a phone dims and locks a minute into the ride, and the
// browser stops delivering GPS. The lock is released automatically when
// the tab is hidden, so it is re-acquired when the rider comes back.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return undefined;

    let lock = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || lock || document.visibilityState !== "visible") return;
      try {
        const granted = await navigator.wakeLock.request("screen");
        if (cancelled) { granted.release().catch(() => {}); return; }
        lock = granted;
        granted.addEventListener?.("release", () => { if (lock === granted) lock = null; });
      } catch {
        // Refused (battery saver, permissions policy) — nothing else to do.
      }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);
}

// ── A remembered on/off switch ───────────────────────────────
export function usePersistentFlag(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "on") return true;
      if (saved === "off") return false;
    } catch {
      // storage unavailable
    }
    return initial;
  });

  const update = useCallback((next) => {
    setValue((previous) => (typeof next === "function" ? Boolean(next(previous)) : Boolean(next)));
  }, []);

  useEffect(() => {
    try { localStorage.setItem(key, value ? "on" : "off"); } catch { /* storage unavailable */ }
  }, [key, value]);

  return [value, update];
}
