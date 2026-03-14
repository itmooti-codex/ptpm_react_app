import { useAuth } from "../shared/hooks/useAuth.js";
import { LoginPage } from "../features/auth/pages/LoginPage.jsx";
import { getCurrentUserId } from "../config/userConfig.js";

export function AuthGate({ children }) {
  const { isAuthenticated, isVerifying, user } = useAuth();

  // Public quote routes bypass auth
  const isPublicRoute =
    typeof window !== "undefined" && window.location.pathname.startsWith("/quote/");
  if (isPublicRoute) {
    const userId = getCurrentUserId();
    return typeof children === "function" ? children(userId) : children;
  }

  // Show loading while verifying stored token
  if (isVerifying) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 font-['Inter']">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
          Checking session...
        </div>
      </main>
    );
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated — render the app with the contact ID
  const activeUserId = String(user?.contactId || getCurrentUserId() || "");
  return typeof children === "function" ? children(activeUserId) : children;
}
