import { useState, useRef } from 'react';
import { useLocationSearch } from '../../hooks/useLocationSearch';

export default function LocationSearchInput({
  icon = 'fa-map-marker-alt',
  iconColor = '#22c55e',
  placeholder = 'Search location...',
  value,
  onChange,
  onSelect,
  tc = {},
}) {
  const { results, loading, search, clear } = useLocationSearch(500);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

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
    <div style={{ position: 'relative' }}>
      {/* Left icon */}
      <i
        className={`fa ${icon}`}
        style={{
          position: 'absolute', left: '14px', top: '50%',
          transform: 'translateY(-50%)',
          color: iconColor, fontSize: '14px',
          pointerEvents: 'none', zIndex: 1,
        }}
      />

      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(249,115,22,0.5)';
          if (value) { search(value); setOpen(true); }
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(255,255,255,0.12)';
          // Delay closing so click on a result fires first
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        className={tc.input || ''}
        style={{
          width: '100%',
          paddingLeft: '40px',
          paddingRight: loading ? '40px' : '16px',
          paddingTop: '14px',
          paddingBottom: '14px',
          borderRadius: '14px',
          border: '1.5px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.05)',
          outline: 'none',
          fontSize: '14px',
          color: 'inherit',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
      />

      {/* Spinner shown while fetching OSM results */}
      {loading && (
        <i
          className="fa fa-spinner fa-spin"
          style={{
            position: 'absolute', right: '14px', top: '50%',
            transform: 'translateY(-50%)',
            color: iconColor, fontSize: '13px',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Dropdown with OSM results */}
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            zIndex: 100,
            background: 'rgba(10,10,15,0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            marginTop: '6px',
          }}
        >
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={e => e.preventDefault()} // prevent blur before click
              onClick={() => handlePick(r)}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                lineHeight: '1.4',
                border: 'none',
                outline: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <i
                className="fa fa-location-dot"
                style={{ color: iconColor, fontSize: '12px', flexShrink: 0, marginTop: '2px' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
