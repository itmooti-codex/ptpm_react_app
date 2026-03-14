import { getUserColumns } from "./columns/userColumns.jsx";

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserManagementTable({
  users,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onRowClick,
}) {
  const columns = getUserColumns();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-400">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-400">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50"
                  onClick={() => onRowClick(user)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(user)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
