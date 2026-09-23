// ============================================================
// 🎤 useVoice HOOK — Voice command recognition
// ============================================================

import { useState, useCallback, useEffect, useRef } from "react";

export function useVoice(commands = {}) {
  const [voiceMode, setVoiceMode] = useState(false);
  const recognitionRef = useRef(null); // current recognition instance
  const timerRef = useRef(0);          // auto-stop timer id

  const startVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice not supported on this browser. Try Chrome or Edge.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase().trim();
      console.log("🎤 Heard:", text);

      for (const [keyword, fn] of Object.entries(commands)) {
        if (text.includes(keyword)) {
          fn();
          break;
        }
      }
    };

    rec.onend = () => setVoiceMode(false);
    rec.onerror = () => setVoiceMode(false);

    // Stop any previous session before starting a new one
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    clearTimeout(timerRef.current);
    recognitionRef.current = rec;
    rec.start();
    setVoiceMode(true);

    // Auto-stop after 6 seconds (timer tracked so unmount can cancel it)
    timerRef.current = setTimeout(() => {
      try { rec.stop(); } catch { /* already stopped */ }
      setVoiceMode(false);
    }, 6000);
  }, [commands]);

  // Cleanup on unmount: stop the mic + cancel the timer so neither can
  // fire setState (or keep recording) after the page is gone.
  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    clearTimeout(timerRef.current);
  }, []);

  return {
    voiceMode,
    startVoice,
    voiceSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}