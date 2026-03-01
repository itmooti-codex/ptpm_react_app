export function PageScaffold({ header, sidebar, children }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {header}
      <div className="flex w-full gap-3">
        {sidebar}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
