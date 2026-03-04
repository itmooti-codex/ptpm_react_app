// Dashboard SDK transport + formatting utilities.
// Self-contained — no cross-feature imports.

export function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          subscription?.unsubscribe?.();
        },
        error: (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        },
      });
    });
    promise.cancel = () => subscription?.unsubscribe?.();
    return promise;
  }
  return Promise.resolve(result);
}

export async function fetchDirectWithTimeout(query, options = null, timeoutMs = 30000) {
  if (!query?.fetchDirect) {
    throw new Error("Invalid query object for fetchDirect.");
  }
  const request = options ? query.fetchDirect(options) : query.fetchDirect();
  const requestPromise = toPromiseLike(request);
  let timeoutId = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        requestPromise?.cancel?.();
        reject(new Error(`Query request timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    });
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Extracts a flat array of records from any Budibase SDK response shape.
function extractRecords(res) {
  if (!res) return [];
  // fetchDirect → {resp: [...]}
  if (Array.isArray(res?.resp)) return res.resp;
  if (Array.isArray(res?.records)) return res.records;
  if (Array.isArray(res?.data)) return res.data;
  if (res?.data && typeof res.data === "object") {
    for (const v of Object.values(res.data)) {
      if (Array.isArray(v)) return v;
    }
  }
  // Raw GQL event: {type:"GQL_DATA", payload:{data:{getDeals:[...]}}}
  if (res?.payload?.data && typeof res.payload.data === "object") {
    for (const v of Object.values(res.payload.data)) {
      if (Array.isArray(v)) return v;
    }
  }
  if (Array.isArray(res)) return res;
  return [];
}

// Extracts records from a subscription or fetch() payload.
// SDK fetch() resolves to {records: {id: Record, ...}} (Object keyed by id).
// fetchDirect() resolves to {resp: [...]}.
export function extractFromPayload(payload) {
  if (!payload) return [];
  const extracted = extractRecords(payload);
  if (Array.isArray(extracted) && extracted.length > 0) {
    return extracted;
  }
  // SDK payload.records: Object keyed by record ID
  if (
    payload?.records != null &&
    typeof payload.records === "object" &&
    !Array.isArray(payload.records)
  ) {
    return Object.values(payload.records);
  }
  return [];
}

// Fetches the total count from a calc query built with fromGraphql() or
// getOrInitQueryCalc(). The query should have .noDestroy() applied.
// The calc response shape: {resp: [{totalCount: N}]}
export async function fetchCalcCount(query) {
  try {
    const res = await fetchDirectWithTimeout(query);
    const rows = extractRecords(res);
    if (rows.length === 0) return 0;
    const first = rows[0];
    const count = first?.totalCount ?? first?.total_count ?? first?.count;
    return typeof count === "number" ? count : rows.length;
  } catch (err) {
    console.warn("[dashboardCore] fetchCalcCount failed:", err);
    return 0;
  }
}

function parseLocalIsoDate(iso) {
  const text = String(iso || "").trim();
  const parts = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// Converts Unix epoch seconds to "DD-MM-YYYY" (local date only).
export function formatUnixDate(ts) {
  if (!ts) return null;
  const date = new Date(Number(ts) * 1000);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Converts ISO date strings ("YYYY-MM-DD") to epoch seconds range.
// Returns null values when inputs are absent.
export function toEpochRange(dateFrom, dateTo) {
  function toEpoch(iso, endOfDay = false) {
    if (!iso) return null;
    const d = parseLocalIsoDate(iso);
    if (isNaN(d.getTime())) return null;
    if (endOfDay) {
      d.setHours(23, 59, 59, 999);
    } else {
      d.setHours(0, 0, 0, 0);
    }
    return Math.floor(d.getTime() / 1000);
  }
  return {
    startEpoch: toEpoch(dateFrom, false),
    endEpoch: toEpoch(dateTo, true),
  };
}
