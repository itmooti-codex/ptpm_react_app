function toText(value) {
  return String(value ?? "").trim();
}

function toPromiseLike(result) {
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
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
    promise.cancel = () => subscription?.unsubscribe?.();
    return promise;
  }
  return Promise.resolve(result);
}

function extractRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.resp)) return payload.resp;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    const firstArray = Object.values(payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    const firstArray = Object.values(payload.payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
  }
  return [];
}

function readField(record, keys) {
  for (const key of keys) {
    if (record?.[key] != null) return record[key];
    if (record?.data?.[key] != null) return record.data[key];
    if (record?._data?.[key] != null) return record._data[key];
  }
  return "";
}

function pickFirstRecord(payload) {
  const rows = extractRows(payload);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

export function buildFocusToken(kind, id) {
  const safeKind = toText(kind).toLowerCase();
  const safeId = toText(id);
  if (!safeKind || !safeId) return "";
  return `${safeKind}:${safeId}`;
}

export function parseFocusToken(value) {
  const text = toText(value);
  if (!text) return { kind: "", id: "" };
  const match = text.match(/^([^:|]+):(.*)$/);
  if (!match) return { kind: "", id: "" };
  return {
    kind: toText(match[1]).toLowerCase(),
    id: toText(match[2]),
  };
}

export function buildExtraId({
  entity = "",
  entityId = "",
  entityIds = [],
  action = "",
  kind = "",
  id = "",
  jobId = "",
  inquiryId = "",
  uid = "",
  tab = "",
  openMemo = false,
} = {}) {
  const normalizedEntity = toText(entity || kind).toLowerCase();
  const normalizedEntityId = toText(entityId || id);
  const normalizedEntityIds = Array.from(
    new Set((Array.isArray(entityIds) ? entityIds : []).map((item) => toText(item)).filter(Boolean))
  );
  const parts = ["v2"];
  const push = (key, value) => {
    const text = toText(value);
    if (!text) return;
    parts.push(`${key}=${encodeURIComponent(text)}`);
  };
  push("entity", normalizedEntity);
  push("entity_id", normalizedEntityId);
  if (normalizedEntityIds.length) {
    push("entity_ids", normalizedEntityIds.join(","));
  }
  push("action", action);
  push("job_id", jobId);
  push("inquiry_id", inquiryId);
  push("uid", uid);
  push("tab", tab);
  if (openMemo) parts.push("memo=1");
  return parts.join("|");
}

export function parseExtraId(value) {
  const text = toText(value);
  if (!text) {
    return {
      entity: "",
      entityId: "",
      entityIds: [],
      action: "",
      kind: "",
      id: "",
      jobId: "",
      inquiryId: "",
      uid: "",
      tab: "",
      openMemo: false,
    };
  }

  const output = {
    entity: "",
    entityId: "",
    entityIds: [],
    action: "",
    kind: "",
    id: "",
    jobId: "",
    inquiryId: "",
    uid: "",
    tab: "",
    openMemo: false,
  };

  const bracketMatch = text.match(/^([a-zA-Z0-9_/-]+)\[(.*)\]$/);
  if (bracketMatch) {
    output.entity = toText(bracketMatch[1]).toLowerCase();
    output.kind = output.entity;
    const ids = toText(bracketMatch[2])
      .split(",")
      .map((item) => toText(item))
      .filter(Boolean);
    output.entityIds = ids;
    output.entityId = ids.length === 1 ? ids[0] : "";
    output.id = output.entityId;
    return output;
  }

  if (text.startsWith("v2|")) {
    const segments = text.split("|").slice(1);
    for (const segment of segments) {
      if (!segment) continue;
      if (segment === "memo=1") {
        output.openMemo = true;
        continue;
      }
      const idx = segment.indexOf("=");
      if (idx < 0) continue;
      const key = segment.slice(0, idx);
      const rawValue = segment.slice(idx + 1);
      const valueDecoded = (() => {
        try {
          return decodeURIComponent(rawValue);
        } catch {
          return rawValue;
        }
      })();

      if (key === "entity") output.entity = toText(valueDecoded).toLowerCase();
      if (key === "entity_id") output.entityId = toText(valueDecoded);
      if (key === "entity_ids") {
        output.entityIds = toText(valueDecoded)
          .split(",")
          .map((item) => toText(item))
          .filter(Boolean);
      }
      if (key === "action") output.action = toText(valueDecoded).toLowerCase();
      if (key === "job_id") output.jobId = toText(valueDecoded);
      if (key === "inquiry_id") output.inquiryId = toText(valueDecoded);
      if (key === "uid") output.uid = toText(valueDecoded);
      if (key === "tab") output.tab = toText(valueDecoded);
    }
    if (!output.entityId && output.entityIds.length === 1) {
      output.entityId = output.entityIds[0];
    }
    if (!output.entityIds.length && output.entityId) {
      output.entityIds = [output.entityId];
    }
    output.kind = output.entity;
    output.id = output.entityId;
    return output;
  }

  if (!text.startsWith("v1|")) {
    const token = parseFocusToken(text);
    if (token.kind && token.id) {
      output.entity = token.kind;
      output.kind = token.kind;
      output.entityId = token.id;
      output.id = token.id;
    }
    return output;
  }

  const segments = text.split("|").slice(1);
  for (const segment of segments) {
    if (!segment) continue;
    if (segment === "memo=1") {
      output.openMemo = true;
      continue;
    }
    const idx = segment.indexOf("=");
    if (idx < 0) continue;
    const key = segment.slice(0, idx);
    const rawValue = segment.slice(idx + 1);
    const valueDecoded = (() => {
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    })();

    if (key === "kind") output.kind = toText(valueDecoded).toLowerCase();
    if (key === "id") output.id = toText(valueDecoded);
    if (key === "job_id") output.jobId = toText(valueDecoded);
    if (key === "inquiry_id") output.inquiryId = toText(valueDecoded);
    if (key === "uid") output.uid = toText(valueDecoded);
    if (key === "tab") output.tab = toText(valueDecoded);
  }

  output.entity = output.kind;
  output.entityId = output.id;
  output.entityIds = output.id ? [output.id] : [];

  return output;
}

export function buildOriginUrl({ uid = "", tab = "", focusToken = "", openMemo = false } = {}) {
  const safeUid = toText(uid);
  if (!safeUid) return "";
  const params = new URLSearchParams();
  const safeTab = toText(tab);
  const safeFocus = toText(focusToken);
  if (safeTab) params.set("ann_tab", safeTab);
  if (safeFocus) params.set("ann_focus", safeFocus);
  if (openMemo) params.set("ann_open_memo", "1");
  const suffix = params.toString();
  return `/details/${encodeURIComponent(safeUid)}${suffix ? `?${suffix}` : ""}`;
}

export function parseAnnouncementLocationSearch(search = "") {
  const params = new URLSearchParams(search || "");
  const tab = toText(params.get("ann_tab"));
  const focus = parseFocusToken(params.get("ann_focus"));
  const openMemo = toText(params.get("ann_open_memo")) === "1";
  return {
    tab,
    focusKind: focus.kind,
    focusId: focus.id,
    openMemo,
  };
}

function inferTabFromNotification(notification = null) {
  const rawType = toText(notification?.rawType || notification?.type).toLowerCase();
  const text = `${toText(notification?.title)} ${toText(notification?.message)}`.toLowerCase();

  if (text.includes("upload")) return "Uploads";
  if (text.includes("task")) return "Tasks";
  if (text.includes("material")) return "Materials";
  if (text.includes("appointment")) return "Appointments";
  if (text.includes("invoice") || text.includes("payment") || text.includes("bill")) {
    return "Invoice & Payment";
  }
  if (text.includes("activity")) return "Activities";
  if (text.includes("memo") || text.includes("comment") || text.includes("post")) return "Overview";

  if (rawType === "appointment") return "Appointments";
  if (rawType === "inquiry" || rawType === "quote/job" || rawType === "post" || rawType === "comment") {
    return "Overview";
  }
  return "";
}

function inferFocusFromNotification(notification = null, fallbackTab = "") {
  const commentId = toText(notification?.commentId);
  if (commentId) return buildFocusToken("comment", commentId);

  const postId = toText(notification?.postId);
  if (postId) return buildFocusToken("post", postId);

  if (fallbackTab === "Tasks") {
    return buildFocusToken("task", toText(notification?.id));
  }
  if (fallbackTab === "Uploads") {
    return buildFocusToken("upload", toText(notification?.id));
  }

  return "";
}

async function fetchJobUidById(plugin, jobId) {
  const normalizedId = normalizeId(jobId);
  if (!normalizedId || !plugin?.switchTo) return "";
  try {
    const query = plugin
      .switchTo("PeterpmJob")
      .query()
      .where("id", normalizedId)
      .deSelectAll()
      .select(["id", "unique_id"])
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    const record = pickFirstRecord(result);
    return toText(readField(record, ["unique_id", "Unique_ID"]));
  } catch {
    return "";
  }
}

async function fetchInquiryUidById(plugin, inquiryId) {
  const normalizedId = normalizeId(inquiryId);
  if (!normalizedId || !plugin?.switchTo) return "";
  try {
    const query = plugin
      .switchTo("PeterpmDeal")
      .query()
      .where("id", normalizedId)
      .deSelectAll()
      .select(["id", "unique_id"])
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    const record = pickFirstRecord(result);
    return toText(readField(record, ["unique_id", "Unique_ID"]));
  } catch {
    return "";
  }
}

export async function resolveNotificationNavigation(notification, plugin) {
  const extraParsed = parseExtraId(notification?.extraId);
  let preferredTab = toText(extraParsed.tab);
  if (!preferredTab) {
    preferredTab = inferTabFromNotification(notification);
  }
  let focusToken = buildFocusToken(extraParsed.kind, extraParsed.id);
  if (!focusToken) {
    focusToken = inferFocusFromNotification(notification, preferredTab);
  }
  const shouldInferOpenMemo = (() => {
    const rawType = toText(notification?.rawType || notification?.type).toLowerCase();
    if (rawType === "post" || rawType === "comment") return true;
    const text = `${toText(notification?.title)} ${toText(notification?.message)}`.toLowerCase();
    return text.includes("memo") || text.includes("comment") || text.includes("post");
  })();
  const openMemo = Boolean(extraParsed.openMemo || shouldInferOpenMemo);

  const quoteJobId = toText(notification?.quoteJobId || extraParsed.jobId);
  if (quoteJobId) {
    const jobUid = await fetchJobUidById(plugin, quoteJobId);
    if (jobUid) {
      return buildOriginUrl({ uid: jobUid, tab: preferredTab, focusToken, openMemo });
    }
  }

  const inquiryId = toText(notification?.inquiryId || extraParsed.inquiryId);
  if (inquiryId) {
    const inquiryUid = await fetchInquiryUidById(plugin, inquiryId);
    if (inquiryUid) {
      return buildOriginUrl({ uid: inquiryUid, tab: preferredTab, focusToken, openMemo });
    }
  }

  if (extraParsed.uid) {
    return buildOriginUrl({ uid: extraParsed.uid, tab: preferredTab, focusToken, openMemo });
  }

  return "";
}
