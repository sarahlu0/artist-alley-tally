/** Four tally strokes and a slash, beside the name. */
export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <g fill="currentColor">
          <rect x="7" y="6" width="3" height="20" rx="1.5" />
          <rect x="12.5" y="6" width="3" height="20" rx="1.5" />
          <rect x="18" y="6" width="3" height="20" rx="1.5" />
          <rect x="23.5" y="6" width="3" height="20" rx="1.5" />
        </g>
        <path d="M4 21 29 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="logo-name">Artist Alley Tally</span>
    </span>
  );
}
