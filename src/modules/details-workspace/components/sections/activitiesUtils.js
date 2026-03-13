import { toText } from "../../../../shared/utils/formatters.js";

export function toId(value) {
  const normalized = toText(value);
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  return normalized;
}

export function normalizeActivityId(value) {
  const normalized = toText(value);
  if (!normalized) return "";
  return /^\d+$/.test(normalized) ? String(Number.parseInt(normalized, 10)) : normalized;
}

export function formatDateForInput(value) {
  const text = toText(value);
  if (!text) return "";

  const numericText = text.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numericText)) {
    const numeric = Number(numericText);
    if (Number.isFinite(numeric)) {
      const rounded = Math.trunc(numeric);
      const asMs = String(Math.abs(rounded)).length <= 10 ? rounded * 1000 : rounded;
      const parsed = new Date(asMs);
      if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
  }

  const ausMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ausMatch) {
    const day = ausMatch[1].padStart(2, "0");
    const month = ausMatch[2].padStart(2, "0");
    return `${ausMatch[3]}-${month}-${day}`;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(value) {
  const inputDate = formatDateForInput(value);
  if (!inputDate) return "-";

  const parsed = new Date(`${inputDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return inputDate;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatCurrency(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function parseTaskNumber(value) {
  const text = toText(value).toLowerCase();
  const match = text.match(/job\s*(\d+)/);
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  return Number.isFinite(number) ? number : null;
}

export function parseOptionNumber(value) {
  const text = toText(value).toLowerCase();
  const match = text.match(/option\s*(\d+)/);
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  return Number.isFinite(number) ? number : null;
}

export function buildComboKey(task, option) {
  const taskNumber = parseTaskNumber(task);
  const optionNumber = parseOptionNumber(option);
  if (!taskNumber || !optionNumber) return "";
  return `${taskNumber}:${optionNumber}`;
}

export function normalizeServiceRecord(record = {}) {
  const id = toText(record?.id || record?.ID || record?.service_id || record?.Service_ID);
  const name = toText(
    record?.service_name ||
      record?.Service_Name ||
      record?.name ||
      record?.Service_Service_Name
  );
  if (!id || !name) return null;

  const parentId = toText(
    record?.primary_service_id || record?.Primary_Service_ID || record?.parentId
  );
  const rawType = toText(record?.service_type || record?.Service_Type || record?.type);
  const inferredType =
    /option/i.test(rawType) || (parentId && parentId !== id) ? "option" : "primary";

  return {
    id,
    name,
    type: inferredType,
    parentId,
    priceGuide: toText(record?.Price_Guide || record?.price_guide),
    price: toText(
      record?.service_price ||
        record?.Service_Price ||
        record?.price ||
        record?.Price ||
        record?.activity_price ||
        record?.Activity_Price
    ),
    warranty: toText(
      record?.standard_warranty ||
        record?.Standard_Warranty ||
        record?.warranty ||
        record?.Warranty
    ),
    description: toText(
      record?.service_description ||
        record?.Service_Description ||
        record?.description ||
        record?.Description
    ),
  };
}

export function buildPrefilledActivityText(service = null) {
  const description = toText(service?.description);
  const priceGuide = toText(service?.priceGuide);
  if (!priceGuide) return description;
  return [description, "Price Guide", priceGuide].filter(Boolean).join("\n\n");
}

export function defaultActivityForm() {
  return {
    id: "",
    task: "Job 1",
    option: "Option 1",
    primaryServiceId: "",
    optionServiceId: "",
    service_id: "",
    quantity: "1",
    activity_price: "",
    activity_status: "To Be Scheduled",
    date_required: "",
    activity_text: "",
    warranty: "",
    note: "",
    invoice_to_client: true,
    include_in_quote_subtotal: true,
    include_in_quote: false,
  };
}

export function createFormFromActivity(activity = {}, serviceMap = new Map()) {
  const serviceId = toText(activity?.service_id || activity?.Service_ID);
  const matchedService = serviceMap.get(serviceId) || null;

  let primaryServiceId = "";
  let optionServiceId = "";
  if (matchedService?.type === "option" && matchedService?.parentId) {
    primaryServiceId = toText(matchedService.parentId);
    optionServiceId = matchedService.id;
  } else if (matchedService) {
    primaryServiceId = matchedService.id;
  }

  return {
    id: toText(activity?.id || activity?.ID),
    task: toText(activity?.task || activity?.Task),
    option: toText(activity?.option || activity?.Option),
    primaryServiceId,
    optionServiceId,
    service_id: serviceId,
    quantity: toText(activity?.quantity || activity?.Quantity || "1") || "1",
    activity_price: toText(activity?.activity_price || activity?.Activity_Price),
    activity_status:
      toText(
        activity?.activity_status ||
          activity?.Activity_Status ||
          activity?.status ||
          activity?.Status
      ) || "To Be Scheduled",
    date_required: formatDateForInput(activity?.date_required || activity?.Date_Required),
    activity_text: toText(activity?.activity_text || activity?.Activity_Text),
    warranty: toText(activity?.warranty || activity?.Warranty),
    note: toText(activity?.note || activity?.Note),
    invoice_to_client:
      activity?.invoice_to_client === true ||
      activity?.Invoice_to_Client === true ||
      toText(activity?.invoice_to_client ?? activity?.Invoice_to_Client).toLowerCase() === "true",
    include_in_quote_subtotal:
      activity?.include_in_quote_subtotal === true ||
      activity?.Include_in_Quote_Subtotal === true ||
      activity?.Include_In_Quote_Subtotal === true ||
      toText(activity?.include_in_quote_subtotal ?? activity?.Include_in_Quote_Subtotal ?? activity?.Include_In_Quote_Subtotal).toLowerCase() === "true",
    include_in_quote:
      activity?.include_in_quote === true ||
      activity?.Include_in_Quote === true ||
      activity?.Include_In_Quote === true ||
      toText(activity?.include_in_quote ?? activity?.Include_in_Quote ?? activity?.Include_In_Quote).toLowerCase() === "true",
  };
}
