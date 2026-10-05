// ============================================================
// LocationSearchInput — a place search box with suggestions
//
// Type → suggestions appear underneath. Pick one with a tap, or with
// the keyboard (↑ ↓ to move, Enter to choose, Esc to close). When no
// suggestion is highlighted, Enter submits the typed text (onSubmit).
//
// PROPS
//   icon         icon name shown inside the box
//   label        accessible name of the field
//   placeholder
//   value        the text (controlled)
//   onChange     (text) → the text changed
//   onSelect     ({ label, lat, lng }) → a suggestion was picked
//   onSubmit     () → Enter pressed without a highlighted suggestion
//   near         optional { lat, lng } — places close to it are listed first
//                (default: where the rider is, when that is known)
//   autoFocus
//   tc           theme classes
//
// The search forgives typos and extra words and puts nearby places first
// (see searchPlaces in services/routingApi.js). Each suggestion shows the
// place on one line and where it is on the next, so two places with the
// same name are easy to tell apart.
// ============================================================

import { useId, useState } from "react";
import { useLocationSearch } from "../../hooks/useLocationSearch";
import Icon from "../ui/Icon";

export default function LocationSearchInput({
  icon = "pin",
  label = "Search location",
  placeholder = "Search location…",
  value,
  onChange,
  onSelect,
  onSubmit,
  near = null,
  autoFocus = false,
  tc = {},
}) {
  const { results, loading, searched, failed, search, clear } = useLocationSearch();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listId = useId();

  const handleChange = (event) => {
    const text = event.target.value;
    onChange(text);
    search(text, near);
    setOpen(true);
    setHighlight(-1);
  };

  const pick = (result) => {
    onChange(result.label);
    onSelect(result);
    clear();
    setOpen(false);
    setHighlight(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setHighlight((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      if (open && highlight >= 0 && results[highlight]) {
        event.preventDefault();
        pick(results[highlight]);
      } else if (onSubmit) {
        event.preventDefault();
        setOpen(false);
        onSubmit();
      }
    } else if (event.key === "Escape" && open) {
      event.stopPropagation(); // close the list, not the whole sheet
      setOpen(false);
    }
  };

  const showList = open && results.length > 0;
  const showEmpty = open && !loading && searched && results.length === 0 && (value || "").trim().length >= 2;

  return (
    <div className="relative">
      <Icon
        name={icon}
        size={16}
        className={`pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 ${tc.sub || ""}`}
      />

      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (value) { search(value, near); setOpen(true); } }}
        // Delay closing so a tap on a suggestion lands first
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`w-full rounded-lg border py-3.5 pl-10 text-sm ${loading ? "pr-10" : "pr-4"} ${tc.input || "bg-transparent"}`}
      />

      {loading && (
        <Icon
          name="spinner"
          size={16}
          className={`rw-spin pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 ${tc.sub || ""}`}
        />
      )}

      {(showList || showEmpty) && (
        <div
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border shadow-lg ${tc.card || ""}`}
        >
          {showList && results.map((result, index) => (
            <button
              key={`${result.lat},${result.lng},${index}`}
              type="button"
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => event.preventDefault()} // keep focus in the input
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pick(result)}
              className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-[13px] leading-snug transition-colors ${
                index === highlight ? tc.navActive || "" : tc.cardHover || ""
              } ${index < results.length - 1 ? `border-b ${tc.divider || ""}` : ""}`}
            >
              <Icon name="pin" size={15} className={`mt-0.5 shrink-0 ${tc.sub || ""}`} />
              {result.name ? (
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{result.name}</span>
                  {result.detail && (
                    <span className={`block truncate text-xs ${tc.sub || ""}`}>{result.detail}</span>
                  )}
                </span>
              ) : (
                <span className="line-clamp-2">{result.label}</span>
              )}
            </button>
          ))}

          {showEmpty && (
            <p className={`px-3.5 py-3 text-[13px] ${tc.sub || ""}`}>
              {failed
                ? "Couldn't search right now. Check your connection and try again."
                : "No places found. Try a different spelling or a nearby town."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
