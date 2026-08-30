// ============================================================
// 🎤 useVoice HOOK — Voice command recognition
// ============================================================

import { useState, useCallback, useEffect } from "react";

export function useVoice(commands = {}) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [recognition, setRecognition] = useState(null);

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

    rec.start();
    setRecognition(rec);
    setVoiceMode(true);

    // Auto-stop after 6 seconds
    setTimeout(() => {
      try { rec.stop(); } catch (e) { /* already stopped */ }
      setVoiceMode(false);
    }, 6000);
  }, [commands]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
    };
  }, [recognition]);

  return {
    voiceMode,
    startVoice,
    voiceSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}