const TOKEN_KEY = "ptpm_auth_token";
const USER_KEY = "ptpm_auth_user";

function getApiBase() {
  // In production (Docker), the API is at /api on the same origin.
  // In local dev, proxy through Vite or use an explicit env var.
  return import.meta.env.VITE_API_BASE_URL || "/api";
}

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAuth(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // localStorage unavailable
  }
}

function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // localStorage unavailable
  }
}

export async function login({ email, password }) {
  const base = getApiBase();
  const res = await fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Login failed.");
  }

  storeAuth(data.token, data.user);
  return data;
}

export async function verifyToken() {
  const token = getStoredToken();
  if (!token) return null;

  const base = getApiBase();
  try {
    const res = await fetch(`${base}/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      clearAuth();
      return null;
    }

    const data = await res.json();
    if (data?.valid && data?.user) {
      storeAuth(token, data.user);
      return data.user;
    }

    clearAuth();
    return null;
  } catch {
    return null;
  }
}

export function logout() {
  clearAuth();
}
