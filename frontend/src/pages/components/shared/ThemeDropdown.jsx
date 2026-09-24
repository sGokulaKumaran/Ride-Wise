// ============================================================
// ThemeDropdown — Custom dropdown with full styling control
// Why custom? Native <select> options cannot be styled
// Features: theme tokens, flat surfaces, active indicator, click-outside
// Usage: <ThemeDropdown theme={theme} setTheme={setTheme} tc={tc} />
// ============================================================

import { useState, useEffect, useRef } from "react";
import Icon from "../ui/Icon";
import { themes } from "../../hooks/useTheme";

export default function ThemeDropdown({ theme, setTheme, tc }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = themes[theme];

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-colors ${tc.card} ${tc.cardHover}`}
      >
        <Icon name={current?.icon} size={16} />
        <span className="hidden md:inline text-xs font-bold">{current?.label}</span>
        <Icon
          name="chevronDown"
          size={14}
          className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={`absolute right-0 mt-2 w-44 rounded-xl border overflow-hidden z-50 ${tc.card}`}
        >
          {Object.entries(themes).map(([key, value]) => (
            <button
              key={key}
              onClick={() => { setTheme(key); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors ${
                theme === key ? tc.navActive : tc.cardHover
              }`}
            >
              <Icon name={value.icon} size={16} />
              <span>{value.label}</span>
              {theme === key && (
                <Icon name="check" size={14} className={`ml-auto ${tc.accent}`} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
