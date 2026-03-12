export function getServicePersonName(row) {
  return String(
    row?.serviceman ?? row?.servicePerson ?? row?.serviceProvider ?? ""
  ).trim();
}

export function JobAddressCell({ address }) {
  const value = String(address || "").trim();

  if (!value) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <a
      href={`https://maps.google.com/?q=${encodeURIComponent(value)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block max-w-[240px] truncate text-slate-600 hover:text-[#003882] hover:underline"
      title={value}
      onClick={(e) => e.stopPropagation()}
    >
      {value}
    </a>
  );
}
