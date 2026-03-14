import { getStoredToken } from "../../auth/api/authApi.js";
import { fetchDirectWithTimeout, extractFromPayload } from "@shared/api/dashboardCore.js";
import { normalizeServiceProviderRecord } from "./userManagementNormalizers.js";

// ─── Express API Helpers ─────────────────────────────────────────────────────

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

// ─── Users (Express API → MySQL admin_users) ─────────────────────────────────

export async function fetchUsers() {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/users`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return { users: data.users || [], totalCount: (data.users || []).length };
  } catch (err) {
    console.error("[userManagement] fetchUsers failed", err);
    return { users: [], totalCount: 0 };
  }
}

export async function fetchUserById({ userId } = {}) {
  if (!userId) return null;
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/users/${userId}`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch (err) {
    console.error("[userManagement] fetchUserById failed", err);
    return null;
  }
}

// ─── Service Provider Options (VitalStats — for linking dropdown) ────────────

export async function fetchServiceProviderOptions({ plugin } = {}) {
  if (!plugin) return [];

  try {
    const spModel = plugin.switchTo("PeterpmServiceProvider");
    const gqlQuery = spModel.query().fromGraphql(`
      query calcServiceProviders {
        calcServiceProviders(
          query: [{ limit: 100 }]
        ) {
          ID: field(arg: ["id"])
          Type: field(arg: ["type"])
          Status: field(arg: ["status"])
          Contact_Information_ID: field(arg: ["contact_information_id"])
          Contact_Information_First_Name: field(arg: ["Contact_Information", "first_name"])
          Contact_Information_Last_Name: field(arg: ["Contact_Information", "last_name"])
          Contact_Information_Email: field(arg: ["Contact_Information", "email"])
        }
      }
    `);
    const res = await fetchDirectWithTimeout(gqlQuery, null, 15000);
    const records = extractFromPayload(res);
    return records
      .map((rec) => {
        const id = String(rec?.ID ?? "").trim();
        if (!id) return null;
        const firstName = String(rec?.Contact_Information_First_Name ?? "").trim();
        const lastName = String(rec?.Contact_Information_Last_Name ?? "").trim();
        return {
          id,
          type: String(rec?.Type ?? "").trim(),
          status: String(rec?.Status ?? "").trim(),
          contactId: String(rec?.Contact_Information_ID ?? "").trim(),
          name: [firstName, lastName].filter(Boolean).join(" ") || `SP ${id}`,
          email: String(rec?.Contact_Information_Email ?? "").trim(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("[userManagement] fetchServiceProviderOptions failed", err);
    return [];
  }
}

// ─── Linked Service Provider (VitalStats — by SP ID) ─────────────────────────

export async function fetchLinkedServiceProvider({ plugin, serviceProviderId } = {}) {
  if (!plugin || !serviceProviderId) return null;

  const spModel = plugin.switchTo("PeterpmServiceProvider");
  try {
    const q = spModel
      .query()
      .deSelectAll()
      .select(["id", "status", "type", "work_email", "mobile_number", "workload_capacity"])
      .where("id", serviceProviderId)
      .include("Contact_Information", (sq) =>
        sq.deSelectAll().select(["first_name", "last_name", "profile_image"])
      )
      .limit(1)
      .noDestroy();
    q.getOrInitQueryCalc?.();
    const res = await fetchDirectWithTimeout(q, null, 10000);
    const records = Array.isArray(res?.resp) ? res.resp : extractFromPayload(res);
    const first = records[0];
    return first ? normalizeServiceProviderRecord(first) : null;
  } catch (err) {
    console.error("[userManagement] fetchLinkedServiceProvider failed", err);
    return null;
  }
}
