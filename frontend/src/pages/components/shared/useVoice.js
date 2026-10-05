// ============================================================
// useVoice — spoken commands for the app ("start", "history", "dark"…)
//
//   const { voiceMode, startVoice, voiceSupported } = useVoice({
//     start: () => …, history: () => …,
//   });
//
// startVoice() listens for one phrase (up to 6 seconds) and runs the
// first command whose keyword it contains. Uses the browser's Web
// Speech API; `voiceSupported` is false where that does not exist.
// ============================================================

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "react-toastify";

const getRecognition = () =>
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export function useVoice(commands = {}) {
  const [voiceMode, setVoiceMode] = useState(false);
  const recognitionRef = useRef(null); // current recognition instance
  const timerRef = useRef(0);          // auto-stop timer id

  const startVoice = useCallback(() => {
    const SpeechRecognition = getRecognition();
    if (!SpeechRecognition) {
      toast.info("Voice commands aren't supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const heard = event.results[0][0].transcript.toLowerCase().trim();
      const match = Object.entries(commands).find(([keyword]) => heard.includes(keyword));
      if (match) match[1]();
      else toast.info(`Didn't recognise "${heard}". Try: ${Object.keys(commands).join(", ")}.`);
    };
    recognition.onend = () => setVoiceMode(false);
    recognition.onerror = (event) => {
      setVoiceMode(false);
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        toast.error("Microphone access is blocked. Allow it in your browser settings.");
      }
    };

    // Stop any previous session before starting a new one
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    clearTimeout(timerRef.current);
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      return; // already listening
    }
    setVoiceMode(true);

    // Auto-stop after 6 seconds (tracked so unmount can cancel it)
    timerRef.current = setTimeout(() => {
      try { recognition.stop(); } catch { /* already stopped */ }
      setVoiceMode(false);
    }, 6000);
  }, [commands]);

  // Unmount: stop the mic and the timer so neither outlives the page.
  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    clearTimeout(timerRef.current);
  }, []);

  return { voiceMode, startVoice, voiceSupported: Boolean(getRecognition()) };
}
