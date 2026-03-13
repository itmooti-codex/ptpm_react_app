export function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12C1.5 12 5.5 5.5 12 5.5C18.5 5.5 22.5 12 22.5 12C22.5 12 18.5 18.5 12 18.5C5.5 18.5 1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7H20M9 7V5C9 4.44772 9.44772 4 10 4H14C14.5523 4 15 4.44772 15 5V7M7 7L8 19C8.04343 19.5523 8.50736 20 9.0616 20H14.9384C15.4926 20 15.9566 19.5523 16 19L17 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CustomerEyeIcon({ active = false }) {
  return active ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12C1.5 12 5.5 5.5 12 5.5C18.5 5.5 22.5 12 22.5 12C22.5 12 18.5 18.5 12 18.5C5.5 18.5 1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M19 5L5 19" stroke="currentColor" strokeWidth="0" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12C1.5 12 5.5 5.5 12 5.5C18.5 5.5 22.5 12 22.5 12C22.5 12 18.5 18.5 12 18.5C5.5 18.5 1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FileTypeIcon({ extension = "FILE" }) {
  return (
    <svg width="36" height="40" viewBox="0 0 36 40" fill="none" aria-hidden="true">
      <path
        d="M8 1h14l7 7v29a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z"
        fill="#EFF6FF"
        stroke="#93C5FD"
      />
      <path d="M22 1v7h7" stroke="#93C5FD" />
      <rect x="10" y="23" width="16" height="9" rx="2" fill="#DBEAFE" />
      <text
        x="18"
        y="30"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill="#1E3A8A"
      >
        {String(extension || "FILE").slice(0, 4)}
      </text>
    </svg>
  );
}

export function FormTileIcon() {
  return (
    <svg width="36" height="40" viewBox="0 0 36 40" fill="none" aria-hidden="true">
      <rect x="6" y="1" width="24" height="38" rx="3" fill="#ECFDF5" stroke="#6EE7B7" />
      <path d="M12 11H24M12 17H24M12 23H20" stroke="#047857" strokeWidth="1.4" />
      <rect x="10" y="28" width="16" height="7" rx="2" fill="#A7F3D0" />
      <text x="18" y="33.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#065F46">
        FORM
      </text>
    </svg>
  );
}
