import { normalizeIdentifier } from "../shared/sharedHelpers.js";

export const TASK_RECORD_SELECT_FIELDS = [
  "id",
  "subject",
  "status",
  "assignee_id",
  "date_due",
  "details",
];

function normalizeTaskDateDue(value) {
  if (value === null || value === undefined) return null;
  const asText = String(value).trim();
  if (!asText) return null;

  if (/^\d+$/.test(asText)) {
    const numeric = Number.parseInt(asText, 10);
    if (!Number.isFinite(numeric)) return asText;
    return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : numeric;
  }

  const parsed = new Date(asText);
  if (Number.isNaN(parsed.getTime())) return asText;
  return Math.floor(parsed.getTime() / 1000);
}

export function normalizeTaskMutationPayload(payload = {}, { forCreate = false } = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const next = {};

  const subject = String(source?.subject || source?.Subject || "").trim();
  const details = String(source?.details || source?.Details || "").trim();
  const status = String(source?.status || source?.Status || "").trim();
  const assigneeId = normalizeIdentifier(
    source?.assignee_id || source?.Assignee_ID || source?.assigneeId
  );
  const dateDue = normalizeTaskDateDue(source?.date_due ?? source?.Date_Due ?? source?.due_date);

  if (subject) next.subject = subject;
  if (details) next.details = details;
  if (status) next.status = status;
  if (assigneeId !== "" && assigneeId !== null && assigneeId !== undefined) {
    next.assignee_id = assigneeId;
  }
  if (dateDue !== undefined) {
    next.date_due = dateDue;
  }

  const jobId = normalizeIdentifier(
    source?.Job_id ?? source?.job_id ?? source?.JobID ?? source?.jobId
  );
  const dealId = normalizeIdentifier(
    source?.Deal_id ?? source?.deal_id ?? source?.DealID ?? source?.dealId
  );
  if (jobId !== "" && jobId !== null && jobId !== undefined) {
    next.Job_id = jobId;
  }
  if (dealId !== "" && dealId !== null && dealId !== undefined) {
    next.Deal_id = dealId;
  }

  if (forCreate) {
    // Keep signature compatible with existing callers.
  }

  return next;
}

export function normalizeTaskRecord(rawTask = {}) {
  return {
    id: String(rawTask?.id || rawTask?.ID || "").trim(),
    subject: String(rawTask?.subject || rawTask?.Subject || "").trim(),
    status: String(rawTask?.status || rawTask?.Status || "").trim(),
    assignee_id: String(rawTask?.assignee_id || rawTask?.Assignee_ID || "").trim(),
    date_due: rawTask?.date_due || rawTask?.Date_Due || "",
    details: String(rawTask?.details || rawTask?.Details || "").trim(),
    assignee_first_name: String(
      rawTask?.assignee_first_name || rawTask?.Assignee_First_Name || ""
    ).trim(),
    assignee_last_name: String(
      rawTask?.assignee_last_name || rawTask?.Assignee_Last_Name || ""
    ).trim(),
    assignee_email: String(rawTask?.assignee_email || rawTask?.AssigneeEmail || "").trim(),
  };
}

export function hasMeaningfulTaskContent(task = {}) {
  return Boolean(
    String(task?.subject || "").trim() ||
      String(task?.status || "").trim() ||
      String(task?.date_due || "").trim() ||
      String(task?.details || "").trim() ||
      String(task?.assignee_id || "").trim() ||
      String(task?.assignee_first_name || "").trim() ||
      String(task?.assignee_last_name || "").trim() ||
      String(task?.assignee_email || "").trim()
  );
}

export function buildTaskCalcQuery({ variableName, variableType, relationField } = {}) {
  return `
    query calcTasks($${variableName}: ${variableType}!) {
      calcTasks(query: [{ where: { ${relationField}: $${variableName} } }]) {
        ID: field(arg: ["id"])
        Status: field(arg: ["status"])
        Subject: field(arg: ["subject"])
        Assignee_ID: field(arg: ["assignee_id"])
        Date_Due: field(arg: ["date_due"])
        Details: field(arg: ["details"])
        Assignee_First_Name: field(arg: ["Assignee", "first_name"])
        Assignee_Last_Name: field(arg: ["Assignee", "last_name"])
        AssigneeEmail: field(arg: ["Assignee", "email"])
      }
    }
  `;
}
