import { useState } from "react";
import { useAuth } from "@shared/hooks/useAuth.js";
import appLogo from "../../../assets/logo.webp";

export function LoginPage() {
  const { login, loginError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setLocalError("Email and password are required.");
      return;
    }
    setLocalError("");
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch {
      // loginError is set by the provider
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || loginError;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf4ff_100%)] px-4 py-10 text-slate-900 font-['Inter']">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-[#cfe0f7] bg-white shadow-[0_24px_70px_rgba(0,56,130,0.14)]">
          <div className="border-b border-[#d9e7fb] bg-[linear-gradient(135deg,#003882_0%,#0b4d9a_100%)] px-6 py-6 text-white">
            <div className="flex items-center gap-4">
              <img
                src={appLogo}
                alt="Peter the Possum & Bird Man"
                className="h-14 w-14 rounded-2xl border border-white/20 object-cover"
              />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                  Admin Portal
                </div>
                <h1 className="mt-1 text-2xl font-semibold">Sign In</h1>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6">
            {displayError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {displayError}
              </div>
            ) : null}

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Email
              </span>
              <input
                type="email"
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#003882]"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Password
              </span>
              <input
                type="password"
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#003882]"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-lg bg-[#003882] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#002a63] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
