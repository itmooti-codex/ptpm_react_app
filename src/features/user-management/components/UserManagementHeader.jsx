import { Button } from "@shared/components/ui/Button.jsx";

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 21l-5.2-5.2M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function UserManagementHeader({ search, onSearchChange, onAddUser, totalCount }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Team Members
          {totalCount > 0 ? (
            <span className="ml-2 text-sm font-normal text-slate-500">({totalCount})</span>
          ) : null}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            type="text"
            className="h-8 w-56 rounded border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
            placeholder="Search users..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          className="bg-[#003882]"
          onClick={onAddUser}
        >
          <PlusIcon />
          Add User
        </Button>
      </div>
    </div>
  );
}
