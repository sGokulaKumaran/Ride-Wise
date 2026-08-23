// ============================================================
// 🎤 useVoice HOOK — Voice command recognition
// Uses Web Speech API (works in Chrome/Edge, partial Safari)
// Returns: { voiceMode, startVoice, voiceSupported }
// ============================================================

import { useState, useCallback } from "react";

export function useVoice(commands = {}) {
  const [voiceMode, setVoiceMode] = useState(false);

  const startVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice not supported on this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.toLowerCase().trim();
      console.log("🎤 Heard:", text);

      // Check each command's keywords
      for (const [action, keywords] of Object.entries(commands)) {
        if (keywords.some(k => text.includes(k))) {
          commands[action](); // execute the action
          break;
        }
      }
    };

    recognition.onend = () => setVoiceMode(false);
    recognition.onerror = () => setVoiceMode(false);

    recognition.start();
    setVoiceMode(true);
    
    // Auto-stop after 6 seconds
    setTimeout(() => {
      try { recognition.stop(); } catch (e) {}
      setVoiceMode(false);
    }, 6000);
  }, [commands]);

  return {
    voiceMode,
    startVoice,
    voiceSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}
