function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.09 2.31A1.5 1.5 0 0 0 3.6 3.78l-.01.04C3.01 7.02 4.12 12.07 8.7 16.65c4.58 4.58 9.63 5.69 12.83 5.12l.04-.01a1.5 1.5 0 0 0 1.17-1.49v-3.08a1.5 1.5 0 0 0-1.15-1.46l-3.15-.72a1.5 1.5 0 0 0-1.54.56l-1.18 1.57a12.04 12.04 0 0 1-5.55-5.55l1.57-1.18a1.5 1.5 0 0 0 .56-1.54l-.72-3.15A1.5 1.5 0 0 0 10.1 4.5H6.5c-.47 0-.91.2-1.21.5l-.2-.69Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2 8l10 6 10-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ClientCell({ name, phone, email }) {
  return (
    <div className="min-w-0 max-w-[180px] overflow-hidden">
      <div className="truncate font-medium text-slate-800" title={name || "—"}>
        {name || "—"}
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        {phone && (
          <a
            href={`tel:${phone}`}
            title={phone}
            className="flex items-center text-slate-500 hover:text-[#003882]"
            onClick={(e) => e.stopPropagation()}
          >
            <PhoneIcon />
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#003882]"
            onClick={(e) => e.stopPropagation()}
          >
            <MailIcon />
          </a>
        )}
      </div>
    </div>
  );
}
