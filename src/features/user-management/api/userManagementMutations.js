import { getStoredToken } from "../../auth/api/authApi.js";

function getApiBase() {
  return import.meta.env.VITE_API_BASE_URL || "/api";
}

function authHeaders() {
  const token = getStoredToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Create User (Express API → MySQL) ───────────────────────────────────────

export async function createUser({ payload = {} } = {}) {
  const base = getApiBase();
  const res = await fetch(`${base}/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Unable to create user.");
  }
  return { id: data.id, success: true };
}

// ─── Update User (Express API → MySQL) ───────────────────────────────────────

export async function updateUser({ userId, payload = {} } = {}) {
  if (!userId) throw new Error("User ID is required for update.");

  const base = getApiBase();
  const res = await fetch(`${base}/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Unable to update user.");
  }
  return { id: String(userId), success: true };
}
