import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import {
  getStoredToken,
  getStoredUser,
  login as apiLogin,
  verifyToken,
  logout as apiLogout,
} from "../../features/auth/api/authApi.js";
import { setSelectedDemoUserId } from "../../config/userConfig.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [isVerifying, setIsVerifying] = useState(true);
  const [loginError, setLoginError] = useState("");

  // On mount, verify stored token
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsVerifying(false);
      return;
    }

    verifyToken()
      .then((verifiedUser) => {
        if (verifiedUser) {
          setUser(verifiedUser);
          applyUserIds(verifiedUser);
        } else {
          setUser(null);
        }
      })
      .finally(() => setIsVerifying(false));
  }, []);

  const login = useCallback(async (email, password) => {
    setLoginError("");
    try {
      const result = await apiLogin({ email, password });
      setUser(result.user);
      applyUserIds(result.user);
      return result.user;
    } catch (err) {
      const message = err?.message || "Login failed.";
      setLoginError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
    setLoginError("");
    // Clear the window user IDs
    if (typeof window !== "undefined") {
      window.__PTPM_CURRENT_USER_ID = "";
      window.__ptpmCurrentUserId = "";
      window.__PTPM_SERVICE_PROVIDER_ID = "";
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isVerifying,
      loginError,
      login,
      logout,
    }),
    [user, isVerifying, loginError, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Inject user IDs into the window globals and userConfig system
// so existing providers (CurrentUserProfileProvider, etc.) pick them up
function applyUserIds(user) {
  if (!user || typeof window === "undefined") return;

  const contactId = String(user.contactId || "");
  const spId = String(user.serviceProviderId || "");

  // Set window globals for userConfig.js resolution chain
  window.__PTPM_CURRENT_USER_ID = contactId;
  window.__ptpmCurrentUserId = contactId;
  window.__PTPM_SERVICE_PROVIDER_ID = spId;

  // Also set it via the demo user system so getCurrentUserId() works
  if (contactId) {
    setSelectedDemoUserId(contactId);
  }
}
