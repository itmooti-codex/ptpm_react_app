import { useEffect, useState } from "react";
import { getCurrentUserId } from "../../config/userConfig.js";
import { toText } from "../utils/formatters.js";

function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    return new Promise((resolve, reject) => {
      let settled = false;
      const sub = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          sub?.unsubscribe?.();
        },
        error: (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        },
      });
    });
  }
  return Promise.resolve(result);
}

function extractRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.resp)) return payload.resp;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    const first = Object.values(payload.data).find((v) => Array.isArray(v));
    if (first) return first;
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    const first = Object.values(payload.payload.data).find((v) => Array.isArray(v));
    if (first) return first;
  }
  return [];
}

// Module-level cache — contact → SP record. Stable for the whole session.
const spByContactId = new Map();

async function fetchSpForCurrentUser(plugin) {
  const contactId = normalizeId(getCurrentUserId());
  if (!contactId || !plugin) return null;

  const cacheKey = String(contactId);
  if (spByContactId.has(cacheKey)) return spByContactId.get(cacheKey);

  try {
    const query = plugin.switchTo("PeterpmServiceProvider").query().fromGraphql(`
      query calcServiceProviders($id: PeterpmContactID!) {
        calcServiceProviders(query: [{ where: { contact_information_id: $id } }]) {
          SP_ID: field(arg: ["id"])
          First_Name: field(arg: ["Contact_Information", "first_name"])
          Last_Name: field(arg: ["Contact_Information", "last_name"])
        }
      }
    `);
    const result = await toPromiseLike(query.fetchDirect({ variables: { id: contactId } }));
    const row = extractRows(result)?.[0] || null;
    if (!row) {
      spByContactId.set(cacheKey, null);
      return null;
    }
    const spId = toText(row?.SP_ID || row?.id || row?.ID);
    const firstName = toText(row?.First_Name || row?.first_name || "");
    const lastName = toText(row?.Last_Name || row?.last_name || "");
    const spName = [firstName, lastName].filter(Boolean).join(" ") || `SP #${spId}`;
    const record = { spId, spName };
    spByContactId.set(cacheKey, record);
    return record;
  } catch (err) {
    console.warn("[useCurrentUserServiceProvider] SP lookup failed", err);
    spByContactId.set(cacheKey, null);
    return null;
  }
}

/**
 * Looks up the service provider record for the currently logged-in user
 * (identified by contact ID from userConfig). Result is cached for the session.
 *
 * @param {object|null} plugin - VitalStats plugin instance
 * @returns {{ spId: string, spName: string, isLoading: boolean }}
 */
export function useCurrentUserServiceProvider(plugin) {
  const contactId = getCurrentUserId();
  const cacheKey = String(normalizeId(contactId) || "");

  const [state, setState] = useState(() => {
    if (cacheKey && spByContactId.has(cacheKey)) {
      const cached = spByContactId.get(cacheKey);
      return { spId: cached?.spId || "", spName: cached?.spName || "", isLoading: false };
    }
    return { spId: "", spName: "", isLoading: Boolean(plugin && cacheKey) };
  });

  useEffect(() => {
    if (!plugin || !cacheKey) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }
    if (spByContactId.has(cacheKey)) {
      const cached = spByContactId.get(cacheKey);
      setState({ spId: cached?.spId || "", spName: cached?.spName || "", isLoading: false });
      return;
    }
    setState((prev) => ({ ...prev, isLoading: true }));
    let cancelled = false;
    fetchSpForCurrentUser(plugin).then((record) => {
      if (cancelled) return;
      setState({ spId: record?.spId || "", spName: record?.spName || "", isLoading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [plugin, cacheKey]);

  return state;
}
