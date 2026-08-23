// ============================================================
// 🎨 ThemeDropdown — Custom dropdown with full styling control
// Why custom? Native <select> options cannot be styled
// Features: Glass morphism, animations, active indicator, click-outside
// Usage: <ThemeDropdown theme={theme} setTheme={setTheme} tc={tc} />
// ============================================================

import { useState, useEffect, useRef } from "react";

export default function ThemeDropdown({ theme, setTheme, tc }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

 // Theme data
  const themeData = {
    dark:     { label: "Dark",     icon: "🌙" },
    light:    { label: "Light",    icon: "☀️" },
    warm:     { label: "Warm",     icon: "🌅" },
    midnight: { label: "Midnight", icon: "🌌" },
  };
  

  // ================= CLICK OUTSIDE DROPDOWN =================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = themeData[theme];

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md transition-all hover:scale-105 ${tc.card}`}
      >
        <span>{current.icon}</span>
        <span className="hidden md:inline text-xs font-bold">{current.label}</span>
        <span className={`text-xs transition-transform duration-300 ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute right-0 mt-2 w-44 rounded-xl border backdrop-blur-2xl shadow-2xl z-50 overflow-hidden ${tc.card}`}>
          {Object.entries(themeData).map(([key, value]) => (
            <button
              key={key}
              onClick={() => {
                setTheme(key);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-all hover:bg-white/10 ${
                theme === key ? "bg-white/10" : ""
              }`}
            >
              <span className="text-base">{value.icon}</span>
              <span>{value.label}</span>
              {theme === key && <span className="ml-auto text-green-400 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
