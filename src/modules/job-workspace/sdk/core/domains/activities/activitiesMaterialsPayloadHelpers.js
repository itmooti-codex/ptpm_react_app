import {
  normalizeIdentifier,
  parseBooleanValue,
  parseUploadFileObject,
} from "../shared/sharedHelpers.js";
import { getActivityServiceParts } from "@shared/utils/formatters.js";

function normalizeCurrencyString(value) {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).replace(/[^0-9.-]+/g, "").trim();
  if (!normalized) return "";
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(2);
}

function normalizeActivityDateRequired(value) {
  if (value === null || value === undefined || value === "") return null;

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (!Number.isFinite(numeric)) return null;
    return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : numeric;
  }

  const ausMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ausMatch) {
    const day = ausMatch[1].padStart(2, "0");
    const month = ausMatch[2].padStart(2, "0");
    const iso = `${ausMatch[3]}-${month}-${day}`;
    const parsed = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

export function normalizeActivityRecord(rawActivity = {}) {
  const { service, primaryService, serviceName, primaryServiceName } =
    getActivityServiceParts(rawActivity);
  const normalizedService = service
    ? {
        ...service,
        ...(primaryService ? { Primary_Service: primaryService } : {}),
      }
    : null;

  return {
    id: String(rawActivity?.id || rawActivity?.ID || "").trim(),
    service_id: String(rawActivity?.service_id || rawActivity?.Service_ID || "").trim(),
    task: String(rawActivity?.task || rawActivity?.Task || "").trim(),
    option: String(rawActivity?.option || rawActivity?.Option || "").trim(),
    quantity: String(rawActivity?.quantity || rawActivity?.Quantity || "1").trim(),
    activity_price: String(
      rawActivity?.activity_price || rawActivity?.Activity_Price || ""
    ).trim(),
    activity_text: String(rawActivity?.activity_text || rawActivity?.Activity_Text || "").trim(),
    activity_status: String(
      rawActivity?.activity_status ||
        rawActivity?.Activity_Status ||
        rawActivity?.Activity_status ||
        rawActivity?.status ||
        rawActivity?.Status ||
        ""
    ).trim(),
    status: String(rawActivity?.status || rawActivity?.Status || "").trim(),
    date_required:
      rawActivity?.date_required || rawActivity?.Date_Required || rawActivity?.date || "",
    quoted_price: String(rawActivity?.quoted_price || rawActivity?.Quoted_Price || "").trim(),
    quoted_text: String(rawActivity?.quoted_text || rawActivity?.Quoted_Text || "").trim(),
    note: String(rawActivity?.note || rawActivity?.Note || "").trim(),
    warranty: String(rawActivity?.warranty || rawActivity?.Warranty || "").trim(),
    include_in_quote_subtotal: parseBooleanValue(
      rawActivity?.include_in_quote_subtotal ?? rawActivity?.Include_in_Quote_Subtotal ?? rawActivity?.Include_In_Quote_Subtotal
    ),
    include_in_quote: parseBooleanValue(
      rawActivity?.include_in_quote ?? rawActivity?.Include_in_Quote ?? rawActivity?.Include_In_Quote
    ),
    invoice_to_client: parseBooleanValue(
      rawActivity?.invoice_to_client ?? rawActivity?.Invoice_to_Client
    ),
    service_name: serviceName,
    primary_service_name: primaryServiceName,
    ...(normalizedService ? { Service: normalizedService } : {}),
  };
}

export function normalizeActivityMutationPayload(payload = {}, { forCreate = false } = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const next = {};

  const jobId = normalizeIdentifier(source?.job_id ?? source?.Job_ID ?? source?.jobId);
  const serviceId = normalizeIdentifier(
    source?.service_id ?? source?.Service_ID ?? source?.serviceId
  );
  const quantityRaw = normalizeIdentifier(source?.quantity ?? source?.Quantity ?? "1");
  const quantity =
    quantityRaw === "" || quantityRaw === null || quantityRaw === undefined ? 1 : quantityRaw;
  const activityPrice = normalizeCurrencyString(
    source?.activity_price ?? source?.Activity_Price ?? source?.activityPrice
  );
  const dateRequired = normalizeActivityDateRequired(
    source?.date_required ?? source?.Date_Required ?? source?.dateRequired
  );

  next.task = String(source?.task ?? source?.Task ?? "").trim();
  next.option = String(source?.option ?? source?.Option ?? "").trim();
  next.quantity = quantity;
  next.warranty = String(source?.warranty ?? source?.Warranty ?? "").trim();
  next.activity_text = String(source?.activity_text ?? source?.Activity_Text ?? "").trim();
  next.activity_status = String(
    source?.activity_status ??
      source?.Activity_Status ??
      source?.status ??
      source?.Status ??
      "To Be Scheduled"
  ).trim();
  next.include_in_quote = parseBooleanValue(
    source?.include_in_quote ?? source?.Include_in_Quote ?? source?.Include_In_Quote
  );
  next.include_in_quote_subtotal = parseBooleanValue(
    source?.include_in_quote_subtotal ?? source?.Include_in_Quote_Subtotal ?? source?.Include_In_Quote_Subtotal ?? true
  );
  next.invoice_to_client = parseBooleanValue(
    source?.invoice_to_client ?? source?.Invoice_to_Client ?? true
  );
  next.note = String(source?.note ?? source?.Note ?? "").trim();
  if (activityPrice) next.activity_price = activityPrice;
  if (serviceId !== "" && serviceId !== null && serviceId !== undefined) {
    next.service_id = serviceId;
  }
  if (dateRequired !== null) next.date_required = dateRequired;
  if (forCreate && (jobId === "" || jobId === null || jobId === undefined)) {
    throw new Error("Activity create is missing job ID.");
  }
  if (forCreate) next.job_id = jobId;
  return next;
}

export function normalizeMaterialRecord(rawMaterial = {}) {
  const provider = rawMaterial?.Service_Provider || {};
  const contact = provider?.Contact_Information || {};
  const providerFirstName = String(
    rawMaterial?.service_provider_contact_information_first_name ||
      rawMaterial?.Service_Provider_Contact_Information_First_Name ||
      rawMaterial?.contact_first_name ||
      rawMaterial?.Contact_First_Name ||
      contact?.first_name ||
      contact?.First_Name ||
      ""
  ).trim();
  const providerLastName = String(
    rawMaterial?.service_provider_contact_information_last_name ||
      rawMaterial?.Service_Provider_Contact_Information_Last_Name ||
      rawMaterial?.contact_last_name ||
      rawMaterial?.Contact_Last_Name ||
      contact?.last_name ||
      contact?.Last_Name ||
      ""
  ).trim();

  const fileRaw =
    rawMaterial?.file ??
    rawMaterial?.File ??
    rawMaterial?.receipt ??
    rawMaterial?.Receipt ??
    "";
  const parsedFile = parseUploadFileObject(fileRaw);
  const parsedFileUrl = String(parsedFile?.link || parsedFile?.url || "").trim();
  const fileUrl = parsedFileUrl || String(fileRaw || "").trim();
  const filePayload =
    parsedFile ||
    (fileUrl
      ? {
          link: fileUrl,
          name: String(rawMaterial?.file_name || rawMaterial?.File_Name || "").trim(),
          size: "",
          type: "",
          s3_id: "",
        }
      : "");

  return {
    id: String(rawMaterial?.id || rawMaterial?.ID || "").trim(),
    material_name: String(rawMaterial?.material_name || rawMaterial?.Material_Name || "").trim(),
    status: String(rawMaterial?.status || rawMaterial?.Status || "").trim(),
    total: String(rawMaterial?.total || rawMaterial?.Total || "").trim(),
    tax: String(rawMaterial?.tax || rawMaterial?.Tax || "").trim(),
    description: String(rawMaterial?.description || rawMaterial?.Description || "").trim(),
    created_at: rawMaterial?.created_at || rawMaterial?.Created_At || "",
    transaction_type: String(
      rawMaterial?.transaction_type || rawMaterial?.Transaction_Type || ""
    ).trim(),
    service_provider_id: String(
      rawMaterial?.service_provider_id || rawMaterial?.Service_Provider_ID || ""
    ).trim(),
    receipt: String(rawMaterial?.receipt || rawMaterial?.Receipt || "").trim(),
    file: fileRaw,
    file_payload: filePayload,
    file_url: fileUrl,
    file_name: String(
      rawMaterial?.file_name || rawMaterial?.File_Name || parsedFile?.name || ""
    ).trim(),
    provider_first_name: providerFirstName,
    provider_last_name: providerLastName,
    provider_name: [providerFirstName, providerLastName].filter(Boolean).join(" ").trim(),
  };
}

export function normalizeMaterialMutationPayload(payload = {}, { forCreate = false } = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const next = {};
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(source, key);

  const jobId = normalizeIdentifier(source?.job_id ?? source?.Job_ID ?? source?.jobId);
  const providerId = normalizeIdentifier(
    source?.service_provider_id ??
      source?.Service_Provider_ID ??
      source?.serviceProviderId
  );
  const total = normalizeCurrencyString(source?.total ?? source?.Total ?? source?.total_cost);

  const hasMaterialName = hasOwn("material_name") || hasOwn("Material_Name");
  if (hasMaterialName) {
    next.material_name = String(source?.material_name ?? source?.Material_Name ?? "").trim();
  }

  const hasStatus = hasOwn("status") || hasOwn("Status");
  if (hasStatus) {
    next.status = String(source?.status ?? source?.Status ?? "").trim();
  } else if (forCreate) {
    next.status = "New";
  }

  const hasTax = hasOwn("tax") || hasOwn("Tax");
  if (hasTax) {
    next.tax = String(source?.tax ?? source?.Tax ?? "").trim();
  }

  const hasDescription = hasOwn("description") || hasOwn("Description");
  if (hasDescription) {
    next.description = String(source?.description ?? source?.Description ?? "").trim();
  }

  const hasTransactionType = hasOwn("transaction_type") || hasOwn("Transaction_Type");
  if (hasTransactionType) {
    next.transaction_type = String(
      source?.transaction_type ?? source?.Transaction_Type ?? ""
    ).trim();
  }

  const hasTotal = hasOwn("total") || hasOwn("Total") || hasOwn("total_cost");
  if (hasTotal) {
    next.total = total;
  }

  const hasServiceProviderId =
    hasOwn("service_provider_id") || hasOwn("Service_Provider_ID") || hasOwn("serviceProviderId");
  if (hasServiceProviderId) {
    next.service_provider_id =
      providerId !== "" && providerId !== null && providerId !== undefined ? providerId : "";
  }

  const hasFileField =
    Object.prototype.hasOwnProperty.call(source, "file") ||
    Object.prototype.hasOwnProperty.call(source, "File");
  const fileInput = source?.file ?? source?.File;
  if (hasFileField) {
    if (typeof fileInput === "string") {
      next.file = fileInput.trim();
    } else if (fileInput && typeof fileInput === "object") {
      next.file = fileInput;
    } else {
      next.file = "";
    }
  }

  const hasReceiptField =
    Object.prototype.hasOwnProperty.call(source, "receipt") ||
    Object.prototype.hasOwnProperty.call(source, "Receipt");
  const receipt = String(source?.receipt ?? source?.Receipt ?? "").trim();
  if (hasReceiptField) next.receipt = receipt;
  if (!hasFileField && receipt) next.file = receipt;

  if (forCreate && (jobId === "" || jobId === null || jobId === undefined)) {
    throw new Error("Material create is missing job ID.");
  }
  if (forCreate) next.job_id = jobId;

  return next;
}
