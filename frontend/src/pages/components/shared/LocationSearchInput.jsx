import { useState, useRef } from 'react';
import { useLocationSearch } from '../../hooks/useLocationSearch';
import Icon from '../ui/Icon';

export default function LocationSearchInput({
  icon = 'pin',
  placeholder = 'Search location...',
  value,
  onChange,
  onSelect,
  tc = {},
}) {
  const { results, loading, search, clear } = useLocationSearch(500);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  // Theme tokens are passed in by the caller; these fallbacks keep the
  // component usable (and monochrome) when `tc` is missing.
  const subClass     = tc.sub      || '';
  const hoverClass   = tc.cardHover || '';
  const dividerClass = tc.divider  || '';
  const fieldClass   = tc.input    || 'bg-transparent';
  const surfaceClass = tc.card     || 'bg-[#141416] border-[#26262B]';

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    search(text);
    setOpen(true);
  };

  const handlePick = (result) => {
    onChange(result.label);
    onSelect(result);
    clear();
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Left icon */}
      <Icon
        name={icon}
        size={14}
        className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 ${subClass}`}
      />

      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (value) { search(value); setOpen(true); }
        }}
        onBlur={() => {
          // Delay closing so click on a result fires first
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        className={`w-full pl-10 ${loading ? 'pr-10' : 'pr-4'} py-3.5 rounded-lg border text-sm ${fieldClass}`}
      />

      {/* Spinner shown while fetching OSM results */}
      {loading && (
        <Icon
          name="spinner"
          size={14}
          className={`rw-spin absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${subClass}`}
        />
      )}

      {/* Dropdown with OSM results */}
      {open && results.length > 0 && (
        <div
          className={`absolute top-full left-0 right-0 z-40 mt-1.5 rounded-xl border overflow-hidden ${surfaceClass}`}
        >
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={e => e.preventDefault()} // prevent blur before click
              onClick={() => handlePick(r)}
              className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left text-[13px] leading-snug transition-colors ${hoverClass} ${
                i < results.length - 1 ? `border-b ${dividerClass}` : ''
              }`}
            >
              <Icon
                name="pin"
                size={14}
                className={`mt-0.5 ${subClass}`}
              />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {r.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
