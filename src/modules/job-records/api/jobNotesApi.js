import { toText } from "@shared/utils/formatters.js";
import {
  executeMutationWithOne,
  extractCreatedRecordId,
  extractRowsFromPayload,
  fetchDirectWithTimeout,
  isTimeoutError,
  normalizeId,
  toSortableTimestamp,
} from "./_helpers.js";

function getNoteModel(plugin) {
  if (!plugin?.switchTo) return null;
  const candidates = ["PeterpmNote", "Note"];
  for (const modelName of candidates) {
    try {
      const model = plugin.switchTo(modelName);
      if (model?.query || model?.mutation) return model;
    } catch (_) {}
  }
  return null;
}

function mapNoteAuthorRecord(raw = {}) {
  const author = raw?.Author || {};
  return {
    id: normalizeId(raw?.author_id || raw?.Author_ID || raw?.AuthorID || author?.id || author?.ID),
    first_name: toText(
      author?.first_name || author?.First_Name || raw?.Author_First_Name || raw?.author_first_name
    ),
    last_name: toText(
      author?.last_name || author?.Last_Name || raw?.Author_Last_Name || raw?.author_last_name
    ),
    profile_image: toText(
      author?.profile_image ||
        author?.Profile_Image ||
        raw?.Author_Profile_Image ||
        raw?.author_profile_image
    ),
  };
}

function mapNoteRecord(raw = {}) {
  const author = mapNoteAuthorRecord(raw);
  return {
    id: normalizeId(raw?.id || raw?.ID),
    note: toText(raw?.note || raw?.Note),
    type: toText(raw?.type || raw?.Type) || "Manual",
    date_created: raw?.date_created ?? raw?.Date_Created ?? null,
    author_id: normalizeId(raw?.author_id || raw?.Author_ID || raw?.AuthorID || author?.id),
    job_id: normalizeId(raw?.Job_id || raw?.job_id || raw?.Job_ID),
    deal_id: normalizeId(raw?.Deal_id || raw?.deal_id || raw?.Deal_ID),
    Author: author,
  };
}

function mapContactLogRecord(raw = {}, index = 0) {
  return {
    id: normalizeId(raw?.ObjectLogEntriesID || raw?.objectLogEntriesId) || `contact-log-${index}`,
    contact_id: normalizeId(raw?.Contact_ID || raw?.contact_id),
    type: toText(raw?.ObjectLogEntriesType || raw?.objectLogEntriesType),
    status: toText(raw?.ObjectLogEntriesStatus || raw?.objectLogEntriesStatus),
    subject: toText(raw?.ObjectLogEntriesSubject || raw?.objectLogEntriesSubject),
    details: toText(raw?.ObjectLogEntriesDetails || raw?.objectLogEntriesDetails),
    created_at:
      raw?.ObjectLogEntriesTime ??
      raw?.objectLogEntriesTime ??
      raw?.ObjectLogEntriesCreated_At ??
      raw?.objectLogEntriesCreatedAt ??
      null,
  };
}

function buildContactLogsCalcQuery() {
  return `
    query calcContacts($id: PeterpmContactID!) {
      calcContacts(query: [{ where: { id: $id } }]) {
        Contact_ID: field(arg: ["id"])
        ObjectLogEntriesID: field(arg: ["ObjectLogEntries", "id"])
        ObjectLogEntriesTime: field(arg: ["ObjectLogEntries", "created_at"])
        ObjectLogEntriesType: field(arg: ["ObjectLogEntries", "type"])
        ObjectLogEntriesStatus: field(arg: ["ObjectLogEntries", "status"])
        ObjectLogEntriesSubject: field(arg: ["ObjectLogEntries", "subject"])
        ObjectLogEntriesDetails: field(arg: ["ObjectLogEntries", "details"])
      }
    }
  `;
}

function buildNotesCalcQuery({
  includeDealId = false,
  includeJobId = false,
} = {}) {
  const variableLines = [
    includeDealId ? "$Deal_id: PeterpmDealID!" : "",
    includeJobId ? "$Job_id: PeterpmJobID!" : "",
    "$limit: IntScalar",
    "$offset: IntScalar",
  ].filter(Boolean);

  const queryLines = [];
  if (includeDealId) {
    queryLines.push("{ where: { Deal_id: $Deal_id } }");
  }
  if (includeJobId) {
    queryLines.push(includeDealId ? "{ orWhere: { Job_id: $Job_id } }" : "{ where: { Job_id: $Job_id } }");
  }

  return `
    query calcNotes(
      ${variableLines.join("\n      ")}
    ) {
      calcNotes(
        query: [
          ${queryLines.join("\n          ")}
        ]
        limit: $limit
        offset: $offset
        orderBy: [{ path: ["date_created"], type: desc }]
      ) {
        ID: field(arg: ["id"])
        Note: field(arg: ["note"])
        Type: field(arg: ["type"])
        Date_Created: field(arg: ["date_created"])
        AuthorID: field(arg: ["Author", "id"])
        Author_First_Name: field(arg: ["Author", "first_name"])
        Author_Last_Name: field(arg: ["Author", "last_name"])
        Author_Profile_Image: field(arg: ["Author", "profile_image"])
      }
    }
  `;
}

function normalizeNoteMutationPayload(payload = {}, { forCreate = false } = {}) {
  const source = payload && typeof payload === "object" ? { ...payload } : {};
  delete source.id;
  delete source.ID;

  const normalizedJobId = normalizeId(source?.Job_id || source?.job_id || source?.Job_ID);
  const normalizedDealId = normalizeId(source?.Deal_id || source?.deal_id || source?.Deal_ID);
  const normalizedAuthorId = normalizeId(
    source?.author_id || source?.Author_ID || source?.AuthorID
  );
  const normalizedNote = toText(source?.note || source?.Note);
  const normalizedType = toText(source?.type || source?.Type) || "Manual";
  const normalizedDateCreated = source?.date_created ?? source?.Date_Created ?? null;

  delete source.Job_id;
  delete source.job_id;
  delete source.Job_ID;
  delete source.Deal_id;
  delete source.deal_id;
  delete source.Deal_ID;
  delete source.author_id;
  delete source.Author_ID;
  delete source.AuthorID;
  delete source.note;
  delete source.Note;
  delete source.type;
  delete source.Type;
  delete source.date_created;
  delete source.Date_Created;

  if (normalizedNote) source.note = normalizedNote;
  if (normalizedType) source.type = normalizedType;
  if (forCreate && normalizedJobId) source.Job_id = normalizedJobId;
  if (forCreate && normalizedDealId) source.Deal_id = normalizedDealId;
  if (forCreate && normalizedAuthorId) source.author_id = normalizedAuthorId;
  if (forCreate && normalizedDateCreated != null) source.date_created = normalizedDateCreated;

  return source;
}

export async function fetchNotesForDetails({
  plugin,
  jobId = "",
  inquiryId = "",
  limit = 120,
  offset = 0,
} = {}) {
  const normalizedJobId = normalizeId(jobId);
  const normalizedInquiryId = normalizeId(inquiryId);

  if (!normalizedJobId && !normalizedInquiryId) return [];

  try {
    const noteModel = getNoteModel(plugin);
    if (!noteModel?.query) return [];
    const query = noteModel.query().fromGraphql(
      buildNotesCalcQuery({
        includeDealId: Boolean(normalizedInquiryId),
        includeJobId: Boolean(normalizedJobId),
      })
    );
    const variables = {
      limit,
      offset,
    };
    if (normalizedInquiryId) variables.Deal_id = normalizedInquiryId;
    if (normalizedJobId) variables.Job_id = normalizedJobId;
    const payload = await fetchDirectWithTimeout(
      query,
      {
        variables,
      },
      20000
    );
    const rows = extractRowsFromPayload(payload, "calcNotes");
    const seen = new Set();
    return (Array.isArray(rows) ? rows : [])
      .map((row) => mapNoteRecord(row))
      .filter((row, index) => {
        const key = normalizeId(row?.id) || `note-${index}`;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[jobDetailsSdk] fetchNotesForDetails timed out.");
    } else {
      console.error("[jobDetailsSdk] fetchNotesForDetails failed", error);
    }
    return [];
  }
}

export async function fetchContactLogsForDetails({
  plugin,
  contactId = "",
} = {}) {
  const normalizedContactId = normalizeId(contactId);
  if (!plugin?.switchTo || !normalizedContactId) return [];

  try {
    const query = plugin.switchTo("PeterpmContact").query().fromGraphql(buildContactLogsCalcQuery());
    const payload = await fetchDirectWithTimeout(
      query,
      {
        variables: {
          id: normalizedContactId,
        },
      },
      20000
    );
    const rows = extractRowsFromPayload(payload, "calcContacts");
    return (Array.isArray(rows) ? rows : [])
      .map((row, index) => mapContactLogRecord(row, index))
      .filter(Boolean)
      .sort((left, right) => {
        const timestampDiff = toSortableTimestamp(right?.created_at) - toSortableTimestamp(left?.created_at);
        if (timestampDiff !== 0) return timestampDiff;
        return Number(right?.id || 0) - Number(left?.id || 0);
      });
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[jobDetailsSdk] fetchContactLogsForDetails timed out.");
    } else {
      console.error("[jobDetailsSdk] fetchContactLogsForDetails failed", error);
    }
    return [];
  }
}

export async function createNoteForDetails({ plugin, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const model = getNoteModel(plugin);
  if (!model?.mutation) {
    throw new Error("Note model is unavailable.");
  }
  const mutationPayload = normalizeNoteMutationPayload(payload, { forCreate: true });
  if (!normalizeId(mutationPayload?.Job_id) && !normalizeId(mutationPayload?.Deal_id)) {
    throw new Error("Note create is missing Job_id or Deal_id.");
  }
  if (!toText(mutationPayload?.note)) {
    throw new Error("Note text is required.");
  }
  const result = await executeMutationWithOne(
    model,
    (mutation) => mutation.createOne(mutationPayload),
    "Unable to create note."
  );
  const createdId = extractCreatedRecordId(result, "PeterpmNote");
  return {
    id: normalizeId(createdId),
    ...mutationPayload,
  };
}

export async function updateNoteForDetails({ plugin, noteId = "", id = "", payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedId = normalizeId(noteId || id);
  if (!normalizedId) {
    throw new Error("Note ID is required.");
  }
  const model = getNoteModel(plugin);
  if (!model?.mutation) {
    throw new Error("Note model is unavailable.");
  }
  const mutationPayload = normalizeNoteMutationPayload(payload);
  if (!toText(mutationPayload?.note)) {
    throw new Error("Note text is required.");
  }
  await executeMutationWithOne(
    model,
    (mutation) => mutation.update((query) => query.where("id", normalizedId).set(mutationPayload)),
    "Unable to update note."
  );
  return {
    id: normalizedId,
    ...mutationPayload,
  };
}

export async function deleteNoteForDetails({ plugin, noteId = "", id = "" } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedId = normalizeId(noteId || id);
  if (!normalizedId) {
    throw new Error("Note ID is required.");
  }
  const model = getNoteModel(plugin);
  if (!model?.mutation) {
    throw new Error("Note model is unavailable.");
  }
  await executeMutationWithOne(
    model,
    (mutation) => mutation.delete((query) => query.where("id", normalizedId)),
    "Unable to delete note."
  );
  return normalizedId;
}
