import { EditIcon } from "../icons/index.jsx";

export function DetailsCard({ title, onEdit, editDisabled = false, className = "", children }) {
  const showEditAction = typeof onEdit === "function";
  return (
    <article className={`rounded border border-slate-200 bg-white ${className}`}>
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <div className="text-[13px] font-semibold text-slate-900">{title}</div>
        {showEditAction ? (
          <button
            type="button"
            className="inline-flex items-center justify-center p-0 text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
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
