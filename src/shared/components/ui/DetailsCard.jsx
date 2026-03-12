import { EditIcon } from "../icons/index.jsx";

export function DetailsCard({ title, onEdit, editDisabled = false, className = "", children }) {
  const showEditAction = typeof onEdit === "function";
  return (
    <article className={`rounded-[4px] border border-[#003882] bg-white ${className}`}>
      <header className="flex items-center justify-between rounded-t-[4px] border-b border-[#003882] bg-[#003882] px-2.5 py-1.5">
        <div className="text-[13px] font-semibold text-white">{title}</div>
        {showEditAction ? (
          <button
            type="button"
            className="inline-flex items-center justify-center p-0 text-white transition hover:text-slate-100 disabled:cursor-not-allowed disabled:text-white/50"
            onClick={onEdit}
            disabled={editDisabled}
            aria-label={`Edit ${title}`}
            title={`Edit ${title}`}
          >
            <EditIcon />
          </button>
        ) : null}
      </header>
      <div className="p-2.5">{children}</div>
    </article>
  );
}
