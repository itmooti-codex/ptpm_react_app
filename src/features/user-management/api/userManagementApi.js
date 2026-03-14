import { fetchDirectWithTimeout, extractFromPayload } from "@shared/api/dashboardCore.js";
import {
  normalizeUserRecord,
  normalizeRoleRecord,
  normalizeServiceProviderRecord,
} from "./userManagementNormalizers.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getModel(plugin, name) {
  return plugin.switchTo(name);
}

// ─── Users ───────────────────────────────────────────────────────────────────

const USER_LIST_FIELDS = [
  "id", "first_name", "last_name", "email", "status",
  "last_login", "last_activity", "profile_image", "role_id",
];

const USER_DETAIL_FIELDS = [
  ...USER_LIST_FIELDS,
  "login", "cell_phone", "telephone", "fax",
  "business_name", "business_address", "business_city",
  "business_state", "business_country", "business_zip_postal",
  "language", "timezone", "email_from_name", "reply_to_email",
  "manager_id", "unique_id", "image",
];

export async function fetchUsers({ plugin, page = 1, pageSize = 25, search = "" } = {}) {
  if (!plugin) return { users: [], totalCount: 0 };

  const userModel = getModel(plugin, "PeterpmUser");
  const offset = (page - 1) * pageSize;

  // Try GraphQL calc query first (more reliable for lists)
  try {
    const searchClause = search
      ? `, { orWhere: { first_name: { contains: "${search}" }, last_name: { contains: "${search}" }, email: { contains: "${search}" } } }`
      : "";

    const gqlQuery = userModel.query().fromGraphql(`
      query calcUsers {
        calcUsers(
          query: [
            { limit: ${pageSize}, offset: ${offset}${searchClause} }
          ]
        ) {
          ID: field(arg: ["id"])
          First_Name: field(arg: ["first_name"])
          Last_Name: field(arg: ["last_name"])
          Email: field(arg: ["email"])
          Status: field(arg: ["status"])
          Last_Login: field(arg: ["last_login"])
          Last_Activity: field(arg: ["last_activity"])
          Profile_Image: field(arg: ["profile_image"])
          Role_ID: field(arg: ["role_id"])
        }
      }
    `);
    const res = await fetchDirectWithTimeout(gqlQuery, null, 15000);
    const records = extractFromPayload(res);
    const users = records.map(normalizeUserRecord).filter(Boolean);
    if (users.length > 0 || page === 1) {
      return { users, totalCount: users.length < pageSize ? offset + users.length : -1 };
    }
  } catch (err) {
    console.warn("[userManagement] GraphQL calc query failed, using SDK fallback", err);
  }

  // Fallback: SDK query builder
  try {
    const q = userModel
      .query()
      .deSelectAll()
      .select(USER_LIST_FIELDS)
      .orderBy("last_name", "asc")
      .limit(pageSize)
      .offset(offset)
      .noDestroy();
    q.getOrInitQueryCalc?.();
    const res = await fetchDirectWithTimeout(q, null, 15000);
    const records = Array.isArray(res?.resp) ? res.resp : extractFromPayload(res);
    const users = records.map(normalizeUserRecord).filter(Boolean);
    return { users, totalCount: users.length < pageSize ? offset + users.length : -1 };
  } catch (err) {
    console.error("[userManagement] fetchUsers failed", err);
    return { users: [], totalCount: 0 };
  }
}

export async function fetchUserById({ plugin, userId } = {}) {
  if (!plugin || !userId) return null;

  const userModel = getModel(plugin, "PeterpmUser");
  try {
    const q = userModel
      .query()
      .deSelectAll()
      .select(USER_DETAIL_FIELDS)
      .where("id", userId)
      .noDestroy();
    q.getOrInitQueryCalc?.();
    const res = await fetchDirectWithTimeout(q, null, 15000);
    const records = Array.isArray(res?.resp) ? res.resp : extractFromPayload(res);
    const first = records[0];
    return first ? normalizeUserRecord(first) : null;
  } catch (err) {
    console.error("[userManagement] fetchUserById failed", err);
    return null;
  }
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export async function fetchRoles({ plugin } = {}) {
  if (!plugin) return [];

  const roleModel = getModel(plugin, "PeterpmRole");
  try {
    const q = roleModel
      .query()
      .deSelectAll()
      .select(["id", "role", "role_manager_id"])
      .limit(50)
      .noDestroy();
    q.getOrInitQueryCalc?.();
    const res = await fetchDirectWithTimeout(q, null, 10000);
    const records = Array.isArray(res?.resp) ? res.resp : extractFromPayload(res);
    return records.map(normalizeRoleRecord).filter(Boolean);
  } catch (err) {
    console.error("[userManagement] fetchRoles failed", err);
    return [];
  }
}

// ─── Linked Service Provider ─────────────────────────────────────────────────

export async function fetchLinkedServiceProvider({ plugin, userId } = {}) {
  if (!plugin || !userId) return null;

  const spModel = getModel(plugin, "PeterpmServiceProvider");
  try {
    const q = spModel
      .query()
      .deSelectAll()
      .select([
        "id", "status", "type", "work_email", "mobile_number", "workload_capacity",
      ])
      .where("owner_id", userId)
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
