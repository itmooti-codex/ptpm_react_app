import { Card } from "../../../../shared/components/ui/Card.jsx";

export function JobDirectSplitSection({
  dataSection,
  className = "grid grid-cols-1 gap-4 xl:grid-cols-[440px_1fr]",
  children,
}) {
  return (
    <section data-section={dataSection} className={className}>
      {children}
    </section>
  );
}

export function JobDirectCardFormPanel({
  title,
  className = "",
  children,
}) {
  return (
    <Card className={`space-y-4 ${className}`.trim()}>
      {title ? <h3 className="type-subheadline text-slate-800">{title}</h3> : null}
      {children}
    </Card>
  );
}

export function JobDirectCardTablePanel({
  title,
  className = "",
  children,
}) {
  return (
    <Card className={className}>
      {title ? <h3 className="type-subheadline mb-3 text-slate-800">{title}</h3> : null}
      {children}
    </Card>
  );
}

export function JobDirectMutedPanel({ className = "", children }) {
  return (
    <div className={`rounded border border-slate-200 bg-slate-50 p-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function JobDirectPlainPanel({ className = "", children }) {
  return (
    <div className={`rounded border border-slate-200 bg-white p-3 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function JobDirectFormActionsRow({ className = "", children }) {
  return (
    <div className={`flex items-center justify-end gap-2 border-t border-slate-200 pt-4 ${className}`.trim()}>
      {children}
    </div>
  );
}
