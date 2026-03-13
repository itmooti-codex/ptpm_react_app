export function AccordionSection({ title, isOpen, onToggle, children }) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <button
        type="button"
        className={`flex w-full items-center justify-between bg-[color:var(--color-light)] px-4 py-3 text-left transition-colors hover:bg-[#eaf0f7] ${
          isOpen ? "rounded-t" : "rounded"
        }`}
        onClick={onToggle}
      >
        <span className="type-subheadline-2 text-slate-800">{title}</span>
        <span
          className={`inline-block text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      {isOpen ? <div className="border-t border-slate-200 p-4">{children}</div> : null}
    </section>
  );
}
