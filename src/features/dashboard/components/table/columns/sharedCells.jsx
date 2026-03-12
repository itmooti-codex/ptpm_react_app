import { CopyIcon } from "@shared/components/icons/index.jsx";
import { useToast } from "@shared/providers/ToastProvider.jsx";

export function getServicePersonName(row) {
  return String(
    row?.serviceman ?? row?.servicePerson ?? row?.serviceProvider ?? ""
  ).trim();
}

export function JobAddressCell({ address }) {
  const { success, error } = useToast();
  const value = String(address || "").trim();

  if (!value) {
    return <span className="text-slate-400">—</span>;
  }

  const handleCopyClick = async (event) => {
    event.stopPropagation();
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard is unavailable.");
      }
      await navigator.clipboard.writeText(value);
      success("Copied", "Address copied.");
    } catch (copyError) {
      error("Copy failed", copyError?.message || "Unable to copy address.");
    }
  };

  return (
    <div className="flex max-w-[240px] items-center gap-1.5">
      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(value)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-slate-600 hover:text-[#003882] hover:underline"
        title={value}
        onClick={(event) => event.stopPropagation()}
      >
        {value}
      </a>
      <button
        type="button"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 transition hover:text-slate-700"
        onClick={handleCopyClick}
        aria-label="Copy job address"
        title="Copy address"
      >
        <CopyIcon />
      </button>
    </div>
  );
}
