import { Link, useNavigate } from "react-router-dom";
import { GlobalTopHeader } from "@shared/layout/GlobalTopHeader.jsx";
import { useUserManagementData } from "../hooks/useUserManagementData.js";
import { UserManagementHeader } from "../components/UserManagementHeader.jsx";
import { UserManagementTable } from "../components/UserManagementTable.jsx";

export function UserManagementPage() {
  const navigate = useNavigate();

  const {
    users,
    isLoading,
    search,
    setSearch,
    totalCount,
  } = useUserManagementData();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100 font-['Inter']">
      <GlobalTopHeader />

      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
          <nav className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Link to="/" className="font-medium text-[#003882] hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-600">Team</span>
          </nav>

          <div className="mb-4 rounded-xl border border-[#d7e2f1] bg-gradient-to-r from-[#003882] to-[#0b4d9a] p-5 text-white shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-white/70">Administration</div>
            <h1 className="mt-1 text-2xl font-semibold">Team Management</h1>
            <p className="mt-1 text-sm text-white/85">
              View and manage team members, assign roles, and link service provider profiles.
            </p>
          </div>

          <div className="space-y-4">
            <UserManagementHeader
              search={search}
              onSearchChange={setSearch}
              onAddUser={() => navigate("/admin/users/new")}
              totalCount={totalCount}
            />

            <UserManagementTable
              users={users}
              isLoading={isLoading}
              currentPage={1}
              totalPages={1}
              onPageChange={() => {}}
              onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
