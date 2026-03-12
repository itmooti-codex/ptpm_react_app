import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "../../hooks/useDetailsWorkspaceStore.jsx";
import { selectJobUploads } from "../../state/selectors.js";
import { useRenderWindow } from "../primitives/WorkspaceTablePrimitives.jsx";
import {
  createInquiryUploadFromFile,
  createInquiryUploadRecord,
  createJobUploadFromFile,
  createJobUploadRecord,
  deleteUploadRecord,
  fetchInquiryUploads,
  fetchJobUploads,
  updateUploadRecordFields,
} from "../../api/core/runtime.js";

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12C1.5 12 5.5 5.5 12 5.5C18.5 5.5 22.5 12 22.5 12C22.5 12 18.5 18.5 12 18.5C5.5 18.5 1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7H20M9 7V5C9 4.44772 9.44772 4 10 4H14C14.5523 4 15 4.44772 15 5V7M7 7L8 19C8.04343 19.5523 8.50736 20 9.0616 20H14.9384C15.4926 20 15.9566 19.5523 16 19L17 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CustomerEyeIcon({ active = false }) {
  return active ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12C1.5 12 5.5 5.5 12 5.5C18.5 5.5 22.5 12 22.5 12C22.5 12 18.5 18.5 12 18.5C5.5 18.5 1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M19 5L5 19" stroke="currentColor" strokeWidth="0" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1.5 12C1.5 12 5.5 5.5 12 5.5C18.5 5.5 22.5 12 22.5 12C22.5 12 18.5 18.5 12 18.5C5.5 18.5 1.5 12 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FileTypeIcon({ extension = "FILE" }) {
  return (
    <svg width="36" height="40" viewBox="0 0 36 40" fill="none" aria-hidden="true">
      <path
        d="M8 1h14l7 7v29a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z"
        fill="#EFF6FF"
        stroke="#93C5FD"
      />
      <path d="M22 1v7h7" stroke="#93C5FD" />
      <rect x="10" y="23" width="16" height="9" rx="2" fill="#DBEAFE" />
      <text
        x="18"
        y="30"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill="#1E3A8A"
      >
        {String(extension || "FILE").slice(0, 4)}
      </text>
    </svg>
  );
}

function FormTileIcon() {
  return (
    <svg width="36" height="40" viewBox="0 0 36 40" fill="none" aria-hidden="true">
      <rect x="6" y="1" width="24" height="38" rx="3" fill="#ECFDF5" stroke="#6EE7B7" />
      <path d="M12 11H24M12 17H24M12 23H20" stroke="#047857" strokeWidth="1.4" />
      <rect x="10" y="28" width="16" height="7" rx="2" fill="#A7F3D0" />
      <text x="18" y="33.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#065F46">
        FORM
      </text>
    </svg>
  );
}

const UPLOAD_FILTER_TABS = ["all", "photo", "file", "forms"];
const UPLOADS_CACHE_TTL_MS = 5 * 60 * 1000;
const UPLOADS_CACHE_KEY_PREFIX = "ptpm:uploads-section:v1:";
const PRESTART_FORM_KIND = "prestart";
const PCA_FORM_KIND = "pca";
const PRESTART_ACTIVITY_OPTIONS = [
  "Rat Treatment to Ceiling",
  "Possum Proofing to Roof or Floors",
  "Turkey Trapping",
  "Pigeon Proofing",
  "Dead removal",
  "Other",
];
const PRESTART_CHECKBOX_FIELDS = [
  "f_1_driving_vehicles_on_or_off_roads",
  "f_2_hazardous_chemicals",
  "f_3_non_powered_hand_tools",
  "f_4_powered_hand_tools",
  "f_5_removing_dead_animals",
  "f_6_towing_a_trailer",
  "f_7_use_of_portable_ladders",
  "f_8_working_alone_or_remote",
  "f_9_working_at_heights_using_an_ewp",
  "f_10_working_at_heights",
  "pedestrian_traffic",
  "ground_conditions",
  "asbestos",
  "roof_condition",
  "aboveground_services_inc_powerlines",
  "pets_dangerous_wildlife",
  "weather_storm_rain_hot_cold_or_wind",
  "moisture",
  "degradation",
  "dust",
  "pitch",
  "plan_and_equipment_checked_for_faults",
  "do_you_have_the_right_ppe_for_the_task",
  "ppe_checked_for_faaults_damage_defacts",
  "acknowledgement",
];
const PRESTART_TEXT_FIELDS = ["write_your_name", "potential_hazard", "action_control"];
const PCA_CHECKBOX_FIELDS = [
  "rodents",
  "f_1_ramik_50mg_kg_diphacinone",
  "f_2_sorexa_blocks_0_005g_kg_difenacoum",
  "f_3_generation_block_0_025g_kg_difethialone",
  "f_4_first_formula_0_005_brodifacoum",
  "f_5_racumin_0_37_coumateralyl",
  "f_6_alphachloralose",
  "f_7_country_permethrin_1_permethrin",
  "f_8_dragnet_2_permethrin",
  "f_9_sorexa_sachets_0_005g_kg_difenacoum",
  "f_10_contrac_0_005_bromodiolone",
  "f_11_ditrac_0_005_brodifacoum",
  "f_12_biforce_100gm_l_bifenthrin",
];
const PCA_NUMBER_FIELDS = [
  "rodenticide_blocks_grams",
  "rodenticide_pellets_grams",
  "redenticide_satchets_grams",
  "insecticide_powder_grams",
  "ceiling_void_s",
  "external_walls",
  "garage",
  "kitchen",
  "between_floors",
  "plastic_bait_station_under_house",
];
const PCA_TEXT_FIELDS = [
  "plastic_bait_station_where_and_number",
  "other_place_description_and_number",
  "other_pest",
  "technicians_comments",
];
const PCA_DATETIME_FIELDS = ["time_sent_to_occupant_owner"];
const FORM_KIND_CONFIG = {
  [PRESTART_FORM_KIND]: {
    kind: PRESTART_FORM_KIND,
    title: "Prestart Form",
    shortLabel: "Prestart",
    checkboxFields: PRESTART_CHECKBOX_FIELDS,
    numberFields: [],
    textFields: PRESTART_TEXT_FIELDS,
    datetimeFields: [],
    multilineTextFields: ["potential_hazard", "action_control"],
    includeActivityDescription: true,
  },
  [PCA_FORM_KIND]: {
    kind: PCA_FORM_KIND,
    title: "Pest Control Advice Form",
    shortLabel: "PCA",
    checkboxFields: PCA_CHECKBOX_FIELDS,
    numberFields: PCA_NUMBER_FIELDS,
    textFields: PCA_TEXT_FIELDS,
    datetimeFields: PCA_DATETIME_FIELDS,
    multilineTextFields: ["other_place_description_and_number", "technicians_comments"],
    includeActivityDescription: false,
  },
};

function toText(value) {
  return String(value ?? "").trim();
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return false;
  return ["1", "true", "yes", "y", "checked", "on"].includes(normalized);
}

function toNumberString(value) {
  const normalized = toText(value);
  if (!normalized) return "";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function formatDateDisplay(value = null) {
  const date = value instanceof Date ? value : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseUnixValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (String(Math.trunc(Math.abs(numeric))).length <= 10) {
    return Math.trunc(numeric);
  }
  return Math.trunc(numeric / 1000);
}

function formatDateTimeLocalInput(value = "") {
  const raw = value ?? "";
  const unix = parseUnixValue(raw);
  const date = unix === null ? new Date(raw) : new Date(unix * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function parseDateTimeInputToUnix(value = "") {
  const normalized = toText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

function buildUploadFormDisplayName(kind = PRESTART_FORM_KIND, date = null) {
  const config = FORM_KIND_CONFIG[kind] || FORM_KIND_CONFIG[PRESTART_FORM_KIND];
  return `${config.shortLabel} ${formatDateDisplay(date)}`.trim();
}

function humanizeFieldLabel(fieldName = "") {
  const normalized = toText(fieldName);
  if (!normalized) return "";
  const withoutIndexPrefix = normalized.replace(/^f_\d+_/i, "");
  const withSpaces = withoutIndexPrefix.replaceAll("_", " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return toText(value).length > 0;
}

function inferUploadFormKind(record = null) {
  const name = toText(resolveUploadDisplayName(record)).toLowerCase();
  if (name.startsWith("pca")) return PCA_FORM_KIND;
  if (name.includes("pest control advice")) return PCA_FORM_KIND;
  const hasPcaSignals = [
    ...PCA_CHECKBOX_FIELDS,
    ...PCA_NUMBER_FIELDS,
    ...PCA_TEXT_FIELDS,
    ...PCA_DATETIME_FIELDS,
  ].some((field) => hasMeaningfulValue(record?.[field]));
  return hasPcaSignals ? PCA_FORM_KIND : PRESTART_FORM_KIND;
}

function isUploadFormRecord(record = null) {
  const typeValue = toText(record?.type).toLowerCase();
  if (typeValue === "form") return true;
  const hasKnownFormField = [
    ...PRESTART_CHECKBOX_FIELDS,
    ...PRESTART_TEXT_FIELDS,
    ...PCA_CHECKBOX_FIELDS,
    ...PCA_NUMBER_FIELDS,
    ...PCA_TEXT_FIELDS,
    ...PCA_DATETIME_FIELDS,
    "activity_description",
    "activity_other",
  ].some((field) => hasMeaningfulValue(record?.[field]));
  return hasKnownFormField;
}

function buildUploadFormDraft(kind = PRESTART_FORM_KIND, sourceRecord = null) {
  const config = FORM_KIND_CONFIG[kind] || FORM_KIND_CONFIG[PRESTART_FORM_KIND];
  const draft = {};
  if (config.includeActivityDescription) {
    draft.activity_description = toText(sourceRecord?.activity_description);
    draft.activity_other = toText(sourceRecord?.activity_other);
  }
  config.checkboxFields.forEach((fieldName) => {
    draft[fieldName] = toBoolean(sourceRecord?.[fieldName]);
  });
  config.numberFields.forEach((fieldName) => {
    draft[fieldName] = toNumberString(sourceRecord?.[fieldName]);
  });
  config.textFields.forEach((fieldName) => {
    draft[fieldName] = toText(sourceRecord?.[fieldName]);
  });
  (Array.isArray(config.datetimeFields) ? config.datetimeFields : []).forEach((fieldName) => {
    draft[fieldName] = formatDateTimeLocalInput(sourceRecord?.[fieldName]);
  });
  return draft;
}

function buildUploadFormPayload({
  kind = PRESTART_FORM_KIND,
  draft = {},
  displayName = "",
} = {}) {
  const config = FORM_KIND_CONFIG[kind] || FORM_KIND_CONFIG[PRESTART_FORM_KIND];
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const payload = {
    type: "Form",
    file_name: toText(displayName),
    photo_name: "",
    photo_upload: "",
    file_upload: "",
  };

  if (config.includeActivityDescription) {
    const activityDescription = toText(safeDraft.activity_description);
    payload.activity_description = activityDescription;
    payload.activity_other =
      activityDescription === "Other" ? toText(safeDraft.activity_other) : "";
  }

  config.checkboxFields.forEach((fieldName) => {
    payload[fieldName] = Boolean(safeDraft[fieldName]);
  });
  config.numberFields.forEach((fieldName) => {
    const normalized = toText(safeDraft[fieldName]);
    payload[fieldName] = normalized ? Number(normalized) : null;
  });
  config.textFields.forEach((fieldName) => {
    payload[fieldName] = toText(safeDraft[fieldName]);
  });
  (Array.isArray(config.datetimeFields) ? config.datetimeFields : []).forEach((fieldName) => {
    payload[fieldName] = parseDateTimeInputToUnix(safeDraft[fieldName]);
  });

  return payload;
}

function resolveUploadCategory(record = null) {
  if (isUploadFormRecord(record)) return "forms";
  if (isImageUpload(record)) return "photo";
  return "file";
}

function normalizeRecordId(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^\d+$/.test(raw) ? String(Number.parseInt(raw, 10)) : raw;
}

function normalizeJobId(jobData = null) {
  return normalizeRecordId(jobData?.id || jobData?.ID || "");
}

function formatFileSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function dedupeUploadRecords(records = []) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((item, index) => {
    const key = String(item?.id || item?.url || `upload-${index}`).trim();
    if (!key || map.has(key)) return;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function buildUploadsCacheKey(mode = "job", targetRecordId = "") {
  const normalizedMode = String(mode || "job").trim().toLowerCase();
  const normalizedTarget = normalizeRecordId(targetRecordId);
  if (!normalizedTarget) return "";
  return `${UPLOADS_CACHE_KEY_PREFIX}${normalizedMode}:${normalizedTarget}`;
}

function readUploadsCache(mode = "job", targetRecordId = "") {
  if (!canUseLocalStorage()) return null;
  const key = buildUploadsCacheKey(mode, targetRecordId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const cachedAt = Number(parsed?.cachedAt || 0);
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > UPLOADS_CACHE_TTL_MS) {
      return null;
    }
    return {
      cachedAt,
      records: dedupeUploadRecords(parsed?.records || []),
    };
  } catch {
    return null;
  }
}

function writeUploadsCache(mode = "job", targetRecordId = "", records = []) {
  if (!canUseLocalStorage()) return false;
  const key = buildUploadsCacheKey(mode, targetRecordId);
  if (!key) return false;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        cachedAt: Date.now(),
        records: dedupeUploadRecords(records || []),
      })
    );
    return true;
  } catch {
    return false;
  }
}

function resolveUploadPreviewUrl(record = null) {
  return String(
    record?.url || record?.link || record?.file_url || record?.preview_url || ""
  ).trim();
}

function resolveUploadDisplayName(record = null) {
  return String(record?.name || record?.file_name || record?.title || "Upload").trim() || "Upload";
}

function resolveUploadExtension(record = null) {
  const explicitType = String(record?.type || "").trim().toLowerCase();
  const fromName = resolveUploadDisplayName(record).split(".").pop() || "";
  if (fromName && fromName !== resolveUploadDisplayName(record)) {
    return fromName.toUpperCase();
  }
  if (explicitType.includes("pdf")) return "PDF";
  if (explicitType.includes("image")) return "IMG";
  if (explicitType.includes("sheet") || explicitType.includes("excel") || explicitType.includes("csv")) {
    return "XLS";
  }
  if (explicitType.includes("word")) return "DOC";
  if (explicitType.includes("zip")) return "ZIP";
  return "FILE";
}

function isImageUpload(record = null) {
  const type = String(record?.type || "").toLowerCase();
  const name = resolveUploadDisplayName(record).toLowerCase();
  return (
    type === "photo" ||
    type.includes("image") ||
    type.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].some((suffix) =>
      name.endsWith(suffix)
    )
  );
}

function isPdfUpload(record = null) {
  const type = String(record?.type || "").toLowerCase();
  const name = resolveUploadDisplayName(record).toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

function triggerFileDownload(url = "", name = "") {
  const targetUrl = String(url || "").trim();
  if (!targetUrl) return;
  const fileName = String(name || "").trim();
  const anchor = document.createElement("a");
  anchor.href = targetUrl;
  anchor.rel = "noopener noreferrer";
  anchor.target = "_blank";
  if (fileName) {
    anchor.setAttribute("download", fileName);
  }
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function UploadsSection({
  plugin,
  jobData,
  additionalCreatePayload = null,
  uploadsMode = "job",
  inquiryId = "",
  inquiryUid = "",
  linkedJobId = "",
  highlightUploadId = "",
  layoutMode = "split",
  existingUploadsView = "table",
  onRequestAddUpload = null,
  enableFormUploads = false,
}) {
  const { success, error } = useToast();
  const storeActions = useJobDirectStoreActions();
  const uploads = useJobDirectSelector(selectJobUploads);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [activeUploadsTab, setActiveUploadsTab] = useState("all");
  const [isUploadFormModalOpen, setIsUploadFormModalOpen] = useState(false);
  const [uploadFormKind, setUploadFormKind] = useState(PRESTART_FORM_KIND);
  const [uploadFormDraft, setUploadFormDraft] = useState(() =>
    buildUploadFormDraft(PRESTART_FORM_KIND)
  );
  const [editingUploadFormId, setEditingUploadFormId] = useState("");
  const [isSavingUploadForm, setIsSavingUploadForm] = useState(false);
  const sectionRef = useRef(null);
  const inputRef = useRef(null);
  const pendingUploadsRef = useRef([]);
  const formsEnabled = Boolean(enableFormUploads);
  const jobId = useMemo(() => normalizeJobId(jobData), [jobData]);
  const normalizedInquiryId = useMemo(() => normalizeRecordId(inquiryId), [inquiryId]);
  const normalizedLinkedJobId = useMemo(() => normalizeRecordId(linkedJobId), [linkedJobId]);
  const inquiryIdFromPayload = useMemo(
    () =>
      normalizeRecordId(
        additionalCreatePayload?.inquiry_id ||
          additionalCreatePayload?.Inquiry_ID ||
          additionalCreatePayload?.inquiry_record_id ||
          additionalCreatePayload?.Inquiry_Record_ID
      ),
    [additionalCreatePayload]
  );
  const mode = String(uploadsMode || "job").trim().toLowerCase() === "inquiry" ? "inquiry" : "job";
  const resolvedLayoutMode = String(layoutMode || "split").trim().toLowerCase();
  const isTableOnlyLayout = resolvedLayoutMode === "table";
  const isFormOnlyLayout = resolvedLayoutMode === "form";
  const resolvedExistingUploadsView = String(existingUploadsView || "table")
    .trim()
    .toLowerCase();
  const useUploadTilesView = resolvedExistingUploadsView === "tiles";
  const showUploadComposer = !isTableOnlyLayout;
  const showExistingUploads = !isFormOnlyLayout;
  const isInquiryMode = mode === "inquiry";
  const targetRecordId = isInquiryMode ? normalizedInquiryId : jobId;
  const uploadsCacheMode = isInquiryMode ? "inquiry" : "job";
  const normalizedHighlightUploadId = normalizeRecordId(highlightUploadId);
  const announcementInquiryId = isInquiryMode ? normalizedInquiryId : inquiryIdFromPayload;
  const announcementJobId = isInquiryMode ? normalizedLinkedJobId : jobId;
  const effectiveAdditionalPayload = useMemo(
    () => ({
      ...(additionalCreatePayload && typeof additionalCreatePayload === "object"
        ? additionalCreatePayload
        : {}),
      ...(isInquiryMode && normalizedLinkedJobId
        ? { job_id: normalizedLinkedJobId, Job_ID: normalizedLinkedJobId }
        : {}),
    }),
    [additionalCreatePayload, isInquiryMode, normalizedLinkedJobId]
  );
  const filteredUploads = useMemo(() => {
    if (!formsEnabled || activeUploadsTab === "all") return uploads;
    return (Array.isArray(uploads) ? uploads : []).filter(
      (record) => resolveUploadCategory(record) === activeUploadsTab
    );
  }, [formsEnabled, activeUploadsTab, uploads]);
  const uploadTabCounts = useMemo(() => {
    const uploadRows = Array.isArray(uploads) ? uploads : [];
    const counts = { all: uploadRows.length, photo: 0, file: 0, forms: 0 };
    uploadRows.forEach((record) => {
      const category = resolveUploadCategory(record);
      if (!counts[category] && counts[category] !== 0) return;
      counts[category] += 1;
    });
    return counts;
  }, [uploads]);
  const editingUploadRecord = useMemo(() => {
    if (!editingUploadFormId) return null;
    return (
      (Array.isArray(uploads) ? uploads : []).find(
        (record) => normalizeRecordId(record?.id || record?.ID) === editingUploadFormId
      ) || null
    );
  }, [uploads, editingUploadFormId]);
  const activeUploadFormConfig =
    FORM_KIND_CONFIG[uploadFormKind] || FORM_KIND_CONFIG[PRESTART_FORM_KIND];
  const {
    hasMore: hasMorePendingUploads,
    remainingCount: remainingPendingUploadsCount,
    showMore: showMorePendingUploads,
    shouldWindow: isPendingUploadsWindowed,
    visibleRows: visiblePendingUploads,
  } = useRenderWindow(pendingUploads, {
    threshold: 150,
    pageSize: 100,
  });
  const {
    hasMore: hasMoreExistingUploads,
    remainingCount: remainingExistingUploadsCount,
    showMore: showMoreExistingUploads,
    shouldWindow: isExistingUploadsWindowed,
    visibleRows: visibleExistingUploads,
  } = useRenderWindow(filteredUploads, {
    threshold: 150,
    pageSize: 100,
  });

  useEffect(() => {
    let isActive = true;
    if (!plugin || !targetRecordId) {
      storeActions.replaceEntityCollection("jobUploads", []);
      setLoadError("");
      setIsLoading(false);
      return undefined;
    }

    const cachedUploads = readUploadsCache(uploadsCacheMode, targetRecordId);
    if (cachedUploads) {
      storeActions.replaceEntityCollection("jobUploads", cachedUploads.records || []);
      setIsLoading(false);
      setLoadError("");
    } else {
      setIsLoading(true);
      setLoadError("");
    }

    const fetchPromise = isInquiryMode
      ? fetchInquiryUploads({ plugin, inquiryId: normalizedInquiryId })
      : fetchJobUploads({ plugin, jobId });

    fetchPromise
      .then((records) => {
        if (!isActive) return;
        const normalizedRecords = dedupeUploadRecords(records || []);
        storeActions.replaceEntityCollection("jobUploads", normalizedRecords);
        writeUploadsCache(uploadsCacheMode, targetRecordId, normalizedRecords);
      })
      .catch((fetchError) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading job uploads", fetchError);
        if (!cachedUploads) {
          storeActions.replaceEntityCollection("jobUploads", []);
          setLoadError("Unable to load uploads.");
        }
      })
      .finally(() => {
        if (!isActive) return;
        if (!cachedUploads) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    plugin,
    targetRecordId,
    isInquiryMode,
    normalizedInquiryId,
    jobId,
    storeActions,
    uploadsCacheMode,
  ]);

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  useEffect(
    () => () => {
      pendingUploadsRef.current.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    []
  );

  useEffect(() => {
    setPendingUploads((previous) => {
      previous.forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, [targetRecordId]);

  useEffect(() => {
    if (!formsEnabled && activeUploadsTab !== "all") {
      setActiveUploadsTab("all");
    }
  }, [formsEnabled, activeUploadsTab]);

  useEffect(() => {
    if (!normalizedHighlightUploadId || activeUploadsTab === "all") return;
    const exists = (Array.isArray(uploads) ? uploads : []).some(
      (record) => normalizeRecordId(record?.id || record?.ID) === normalizedHighlightUploadId
    );
    if (exists) {
      setActiveUploadsTab("all");
    }
  }, [activeUploadsTab, normalizedHighlightUploadId, uploads]);

  useEffect(() => {
    if (!normalizedHighlightUploadId || !hasMoreExistingUploads) return;
    const hasVisibleHighlightedRow = visibleExistingUploads.some(
      (record) => normalizeRecordId(record?.id || record?.ID) === normalizedHighlightUploadId
    );
    if (hasVisibleHighlightedRow) return;
    showMoreExistingUploads();
  }, [
    normalizedHighlightUploadId,
    hasMoreExistingUploads,
    visibleExistingUploads,
    showMoreExistingUploads,
  ]);

  useEffect(() => {
    if (!normalizedHighlightUploadId) return;
    const timeoutId = window.setTimeout(() => {
      const root = sectionRef.current;
      if (!root) return;
      const matches = Array.from(root.querySelectorAll('[data-ann-kind="upload"]'));
      const target = matches.find(
        (node) =>
          String(node?.getAttribute("data-ann-id") || "").trim() === normalizedHighlightUploadId
      );
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [normalizedHighlightUploadId, visibleExistingUploads.length]);

  const triggerFilePicker = () => {
    if (!targetRecordId) {
      error(
        "Cannot upload",
        isInquiryMode ? "Inquiry record is not loaded yet." : "Job record is not loaded yet."
      );
      return;
    }
    inputRef.current?.click();
  };

  const queuePendingFiles = (files = []) => {
    if (!files.length || !targetRecordId) return;
    setPendingUploads((previous) => {
      const existingSignatures = new Set(
        previous.map((item) => `${item.name}::${item.size}::${item.type}::${item.lastModified}`)
      );
      const next = [...previous];
      files.forEach((file) => {
        const signature = `${file.name}::${file.size}::${file.type}::${file.lastModified}`;
        if (existingSignatures.has(signature)) return;
        existingSignatures.add(signature);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          lastModified: file.lastModified || 0,
          previewUrl: URL.createObjectURL(file),
          customerCanView: false,
        });
      });
      return next;
    });
  };

  const handleFilesSelected = (event) => {
    const input = event?.target;
    const files = Array.from(input?.files || []);
    queuePendingFiles(files);
    if (input) input.value = "";
  };

  const handleDropZoneDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!targetRecordId || isUploading) return;
    if (!isDropActive) setIsDropActive(true);
  };

  const handleDropZoneDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(false);
  };

  const handleDropZoneDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(false);
    if (!targetRecordId || isUploading) return;
    const files = Array.from(event?.dataTransfer?.files || []);
    queuePendingFiles(files);
  };

  const togglePendingUploadCustomerCanView = (pendingId) => {
    setPendingUploads((previous) =>
      previous.map((item) =>
        item.id === pendingId ? { ...item, customerCanView: !item.customerCanView } : item
      )
    );
  };

  const removePendingUpload = (pendingId) => {
    setPendingUploads((previous) => {
      const next = [];
      previous.forEach((item) => {
        if (item.id === pendingId) {
          if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
          return;
        }
        next.push(item);
      });
      return next;
    });
  };

  const savePendingUploads = async () => {
    if (!plugin || !targetRecordId || !pendingUploads.length || isUploading) return;

    setIsUploading(true);
    setLoadError("");
    const created = [];
    const failed = [];

    for (const pending of pendingUploads) {
      try {
        const perFilePayload = {
          ...effectiveAdditionalPayload,
          customer_can_view: pending.customerCanView === true,
        };
        const saved = isInquiryMode
          ? await createInquiryUploadFromFile({
              plugin,
              inquiryId: normalizedInquiryId,
              file: pending.file,
              uploadPath: `inquiry-uploads/${normalizedInquiryId || inquiryUid || "inquiry"}`,
              additionalPayload: perFilePayload,
            })
          : await createJobUploadFromFile({
              plugin,
              jobId,
              file: pending.file,
              uploadPath: `job-uploads/${jobId}`,
              additionalPayload: perFilePayload,
            });
        if (saved) created.push(saved);
        if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      } catch (uploadError) {
        failed.push({
          ...pending,
          uploadError: uploadError?.message || "Unable to upload file.",
        });
      }
    }

    if (created.length) {
      storeActions.replaceEntityCollection(
        "jobUploads",
        dedupeUploadRecords([...created, ...(uploads || [])])
      );
      const createdUploadIds = created
        .map((record) => normalizeRecordId(record?.id || record?.ID))
        .filter(Boolean);
      emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.UPLOAD_ADDED,
        quoteJobId: announcementJobId,
        inquiryId: announcementInquiryId,
        focusId: createdUploadIds.length === 1 ? createdUploadIds[0] : "",
        focusIds: createdUploadIds,
        dedupeEntityId:
          createdUploadIds.join(",") || `${announcementJobId}:${announcementInquiryId}:upload_batch`,
        title: created.length > 1 ? "New uploads added" : "New upload added",
        content:
          created.length > 1
            ? `${created.length} files were uploaded.`
            : "A new file was uploaded.",
        logContext: "job-direct:UploadsSection:savePendingUploads",
      }).catch((announcementError) => {
        console.warn("[JobDirect] Upload announcement emit failed", announcementError);
      });
    }

    setPendingUploads(failed);

    if (created.length) {
      success(
        created.length > 1 ? "Uploads added" : "Upload added",
        created.length > 1
          ? `${created.length} files were uploaded to this ${isInquiryMode ? "inquiry" : "job"}.`
          : `File was uploaded to this ${isInquiryMode ? "inquiry" : "job"}.`
      );
    }

    if (failed.length) {
      const firstMessage = failed[0]?.uploadError || "Unable to upload one or more files.";
      setLoadError(firstMessage);
      error(
        "Upload failed",
        failed.length === pendingUploads.length
          ? firstMessage
          : `${failed.length} file(s) failed. ${firstMessage}`
      );
    }

    setIsUploading(false);
  };

  const [togglingCustomerCanViewId, setTogglingCustomerCanViewId] = useState("");

  const toggleCustomerCanView = async (record) => {
    const uploadId = String(record?.id || "").trim();
    if (!plugin || !uploadId || togglingCustomerCanViewId === uploadId) return;
    const next = !record.customer_can_view;
    setTogglingCustomerCanViewId(uploadId);
    try {
      await updateUploadRecordFields({ plugin, id: uploadId, payload: { customer_can_view: next } });
      storeActions.replaceEntityCollection(
        "jobUploads",
        (uploads || []).map((u) =>
          String(u?.id || "").trim() === uploadId ? { ...u, customer_can_view: next } : u
        )
      );
      success(
        next ? "Visible to customer" : "Hidden from customer",
        next
          ? "This upload is now visible to the customer."
          : "This upload is now hidden from the customer."
      );
    } catch {
      error("Update failed", "Could not update customer visibility. Please try again.");
    } finally {
      setTogglingCustomerCanViewId("");
    }
  };

  const openCreateUploadForm = (kind = PRESTART_FORM_KIND) => {
    if (!plugin || !targetRecordId) {
      error(
        "Cannot save form",
        isInquiryMode ? "Inquiry record is not loaded yet." : "Job record is not loaded yet."
      );
      return;
    }
    const resolvedKind =
      kind === PCA_FORM_KIND || kind === PRESTART_FORM_KIND ? kind : PRESTART_FORM_KIND;
    setUploadFormKind(resolvedKind);
    setUploadFormDraft(buildUploadFormDraft(resolvedKind));
    setEditingUploadFormId("");
    setIsUploadFormModalOpen(true);
  };

  const openEditUploadForm = (record = null) => {
    const uploadId = normalizeRecordId(record?.id || record?.ID);
    if (!uploadId) return;
    const resolvedKind = inferUploadFormKind(record);
    setUploadFormKind(resolvedKind);
    setUploadFormDraft(buildUploadFormDraft(resolvedKind, record));
    setEditingUploadFormId(uploadId);
    setIsUploadFormModalOpen(true);
  };

  const handleUploadFormFieldChange = (fieldName, value) => {
    setUploadFormDraft((previous) => ({
      ...previous,
      [fieldName]: value,
    }));
  };

  const buildUploadAssociationPayload = (record = null) => {
    const base = {};
    const propertyId = normalizeRecordId(
      record?.property_name_id ||
        effectiveAdditionalPayload?.property_name_id ||
        effectiveAdditionalPayload?.Property_Name_ID
    );
    if (propertyId) {
      base.property_name_id = propertyId;
    }
    const resolvedInquiryId = normalizeRecordId(
      record?.inquiry_id ||
        normalizedInquiryId ||
        effectiveAdditionalPayload?.inquiry_id ||
        effectiveAdditionalPayload?.Inquiry_ID ||
        effectiveAdditionalPayload?.inquiry_record_id ||
        effectiveAdditionalPayload?.Inquiry_Record_ID
    );
    if (resolvedInquiryId) {
      base.inquiry_id = resolvedInquiryId;
    }
    const resolvedJobId = normalizeRecordId(
      record?.job_id ||
        jobId ||
        normalizedLinkedJobId ||
        effectiveAdditionalPayload?.job_id ||
        effectiveAdditionalPayload?.Job_ID
    );
    if (resolvedJobId) {
      base.job_id = resolvedJobId;
    }
    return base;
  };

  const saveUploadForm = async () => {
    if (!plugin || !targetRecordId || isSavingUploadForm) return;
    const displayName =
      toText(editingUploadRecord?.name) || buildUploadFormDisplayName(uploadFormKind, new Date());
    const payload = {
      ...buildUploadAssociationPayload(editingUploadRecord),
      ...buildUploadFormPayload({
        kind: uploadFormKind,
        draft: uploadFormDraft,
        displayName,
      }),
    };
    setIsSavingUploadForm(true);
    try {
      const saved = editingUploadFormId
        ? await updateUploadRecordFields({
            plugin,
            id: editingUploadFormId,
            payload,
          })
        : isInquiryMode
          ? await createInquiryUploadRecord({
              plugin,
              inquiryId: normalizedInquiryId,
              payload,
            })
          : await createJobUploadRecord({
              plugin,
              jobId,
              payload,
            });

      if (saved) {
        if (editingUploadFormId) {
          storeActions.replaceEntityCollection(
            "jobUploads",
            dedupeUploadRecords(
              (uploads || []).map((record) => {
                const recordId = normalizeRecordId(record?.id || record?.ID);
                return recordId === editingUploadFormId ? { ...record, ...saved } : record;
              })
            )
          );
          success("Form updated", `${activeUploadFormConfig.title} was updated.`);
        } else {
          storeActions.replaceEntityCollection(
            "jobUploads",
            dedupeUploadRecords([saved, ...(uploads || [])])
          );
          const createdUploadId = normalizeRecordId(saved?.id || saved?.ID);
          if (createdUploadId) {
            emitAnnouncement({
              plugin,
              eventKey: ANNOUNCEMENT_EVENT_KEYS.UPLOAD_ADDED,
              quoteJobId: announcementJobId,
              inquiryId: announcementInquiryId,
              focusId: createdUploadId,
              focusIds: [createdUploadId],
              dedupeEntityId: `${announcementJobId}:${announcementInquiryId}:upload_form:${createdUploadId}`,
              title: "New form added",
              content: `${activeUploadFormConfig.title} was added.`,
              logContext: "job-direct:UploadsSection:saveUploadForm",
            }).catch((announcementError) => {
              console.warn("[JobDirect] Upload form announcement emit failed", announcementError);
            });
          }
          success("Form added", `${activeUploadFormConfig.title} was added.`);
        }
      }
      setIsUploadFormModalOpen(false);
      setEditingUploadFormId("");
    } catch (saveError) {
      console.error("[JobDirect] Failed saving upload form", saveError);
      error("Unable to save form", saveError?.message || "Please try again.");
    } finally {
      setIsSavingUploadForm(false);
    }
  };

  const confirmDeleteUpload = async () => {
    if (!plugin || !deleteTarget?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteUploadRecord({ plugin, id: deleteTarget.id });
      storeActions.replaceEntityCollection(
        "jobUploads",
        (uploads || []).filter(
          (item) => String(item?.id || "").trim() !== String(deleteTarget?.id || "").trim()
        )
      );
      success("Upload deleted", "Upload was removed.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("[JobDirect] Failed deleting upload", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete upload.");
    } finally {
      setIsDeleting(false);
    }
  };

  const previewUrl = resolveUploadPreviewUrl(previewTarget);
  const previewName = resolveUploadDisplayName(previewTarget);
  const previewExtension = resolveUploadExtension(previewTarget);
  const previewIsImage = isImageUpload(previewTarget);
  const previewIsPdf = isPdfUpload(previewTarget);
  const previewSupportsInline = previewIsImage || previewIsPdf;

  return (
    <section
      ref={sectionRef}
      data-section="uploads"
      className={
        showUploadComposer && showExistingUploads
          ? "grid grid-cols-1 gap-4 xl:grid-cols-[480px_1fr]"
          : "space-y-4"
      }
    >
      {showUploadComposer ? (
      <Card className="space-y-4">
        <h3 className="type-subheadline text-slate-800">Upload Files</h3>
        <div
          className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
            isDropActive
              ? "border-sky-500 bg-sky-50"
              : "border-slate-300 bg-slate-50"
          }`}
          onDragEnter={handleDropZoneDragOver}
          onDragOver={handleDropZoneDragOver}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={handleDropZoneDrop}
        >
          <p className="text-sm text-slate-500">Drag and drop files here or browse</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={triggerFilePicker}
            disabled={!targetRecordId || isUploading}
          >
            Choose Files
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleFilesSelected}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              Pending Uploads ({pendingUploads.length})
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={savePendingUploads}
              disabled={!targetRecordId || !pendingUploads.length || isUploading}
            >
              {isUploading ? "Saving..." : "Save Uploads"}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="w-[40%] px-2 py-2">Name</th>
                  <th className="w-[15%] px-2 py-2">Size</th>
                  <th className="w-[25%] px-2 py-2">Customer Can View</th>
                  <th className="w-[20%] px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!visiblePendingUploads.length ? (
                  <tr>
                    <td className="px-2 py-3 text-slate-400" colSpan={4}>
                      No pending files.
                    </td>
                  </tr>
                ) : (
                  visiblePendingUploads.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-2 py-3 break-all">{record.name}</td>
                      <td className="px-2 py-3">{formatFileSize(record.size)}</td>
                      <td className="px-2 py-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={record.customerCanView === true}
                            onChange={() => togglePendingUploadCustomerCanView(record.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </label>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex w-full items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              if (!record.previewUrl) return;
                              window.open(record.previewUrl, "_blank", "noopener,noreferrer");
                            }}
                            aria-label="View pending upload"
                            title="View"
                            disabled={!record.previewUrl}
                          >
                            <EyeIcon />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700"
                            onClick={() => removePendingUpload(record.id)}
                            aria-label="Remove pending upload"
                            title="Remove"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMorePendingUploads ? (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Showing {visiblePendingUploads.length} of {pendingUploads.length} pending uploads
              </span>
              <Button type="button" variant="outline" onClick={showMorePendingUploads}>
                Load {Math.min(remainingPendingUploadsCount, 100)} more
              </Button>
            </div>
          ) : isPendingUploadsWindowed ? (
            <div className="text-xs text-slate-500">
              Showing all {pendingUploads.length} pending uploads.
            </div>
          ) : null}
        </div>
      </Card>
      ) : null}

      {showExistingUploads ? (
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="type-subheadline text-slate-800">Existing Uploads</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {formsEnabled ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 whitespace-nowrap px-3 text-xs"
                  onClick={() => openCreateUploadForm(PRESTART_FORM_KIND)}
                  disabled={!targetRecordId}
                >
                  Prestart Form
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 whitespace-nowrap px-3 text-xs"
                  onClick={() => openCreateUploadForm(PCA_FORM_KIND)}
                  disabled={!targetRecordId}
                >
                  Pest Control Advice Form
                </Button>
              </>
            ) : null}
            {isTableOnlyLayout && typeof onRequestAddUpload === "function" ? (
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="h-8 whitespace-nowrap px-3 text-xs"
                onClick={() => onRequestAddUpload()}
                disabled={!targetRecordId}
              >
                Add Upload
              </Button>
            ) : null}
          </div>
        </div>

        {formsEnabled ? (
          <div className="inline-flex flex-wrap items-center gap-1 rounded border border-slate-200 bg-slate-50 p-1">
            {UPLOAD_FILTER_TABS.map((tab) => {
              const isActive = activeUploadsTab === tab;
              const label = tab === "forms" ? "Forms" : tab.charAt(0).toUpperCase() + tab.slice(1);
              const count = uploadTabCounts?.[tab] || 0;
              return (
                <button
                  key={tab}
                  type="button"
                  className={`inline-flex h-7 items-center gap-1 rounded px-2.5 text-[11px] font-medium transition ${
                    isActive
                      ? "bg-[#003882] text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                  onClick={() => setActiveUploadsTab(tab)}
                >
                  <span>{label}</span>
                  <span className={isActive ? "text-white/80" : "text-slate-500"}>{count}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!targetRecordId ? (
          <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-400">
            {isInquiryMode ? "Inquiry is not loaded yet." : "Job is not loaded yet."}
          </div>
        ) : null}

        {targetRecordId && isLoading ? (
          <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
            Loading uploads...
          </div>
        ) : null}

        {targetRecordId && !isLoading && loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {loadError}
          </div>
        ) : null}

        {targetRecordId && !isLoading && !loadError ? (
          <>
            {useUploadTilesView ? (
              <div className="flex flex-wrap gap-2">
                {!visibleExistingUploads.length ? (
                  <div className="w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                    {formsEnabled && activeUploadsTab !== "all"
                      ? `No ${activeUploadsTab} uploads available.`
                      : "No uploads available."}
                  </div>
                ) : (
                  visibleExistingUploads.map((record, index) => {
                    const uploadId = String(record?.id || "").trim();
                    const uploadUrl = resolveUploadPreviewUrl(record);
                    const uploadName = resolveUploadDisplayName(record);
                    const isFormUpload = isUploadFormRecord(record);
                    const uploadExtension = isFormUpload ? "FORM" : resolveUploadExtension(record);
                    const supportsInlinePreview =
                      !isFormUpload && (isImageUpload(record) || isPdfUpload(record));
                    const isHighlighted =
                      Boolean(normalizedHighlightUploadId) &&
                      normalizeRecordId(uploadId) === normalizedHighlightUploadId;
                    return (
                      <div
                        key={`${uploadId || uploadUrl || "upload"}-${index}`}
                        data-ann-kind="upload"
                        data-ann-id={normalizeRecordId(uploadId)}
                        data-ann-highlighted={isHighlighted ? "true" : "false"}
                        className={`relative w-[88px] max-w-[88px] rounded border bg-white px-2 py-2 ${
                          isHighlighted ? "border-amber-300 bg-amber-50" : "border-slate-200"
                        }`}
                      >
                        {!isFormUpload ? (
                          <button
                            type="button"
                            className={`absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-40 ${
                              record.customer_can_view
                                ? "text-blue-600 hover:text-blue-800"
                                : "text-slate-300 hover:text-slate-500"
                            }`}
                            onClick={() => toggleCustomerCanView(record)}
                            aria-label={
                              record.customer_can_view
                                ? "Customer can view — click to hide"
                                : "Hidden from customer — click to make visible"
                            }
                            title={
                              record.customer_can_view
                                ? "Customer Can View: On"
                                : "Customer Can View: Off"
                            }
                            disabled={togglingCustomerCanViewId === uploadId}
                          >
                            <CustomerEyeIcon active={record.customer_can_view} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => setDeleteTarget(record)}
                          aria-label="Delete upload"
                          title="Delete Upload"
                          disabled={!uploadId}
                        >
                          <CloseIcon />
                        </button>
                        <div className="flex min-h-[48px] items-center justify-center">
                          {isFormUpload ? (
                            <FormTileIcon />
                          ) : (
                            <FileTypeIcon extension={uploadExtension} />
                          )}
                        </div>
                        <button
                          type="button"
                          className="mt-1 w-full truncate text-center text-[10px] font-medium text-sky-700 underline decoration-sky-500/60 underline-offset-2 hover:text-sky-800 disabled:cursor-not-allowed disabled:text-slate-400"
                          onClick={() => {
                            if (isFormUpload) {
                              openEditUploadForm(record);
                              return;
                            }
                            if (!uploadUrl) return;
                            setPreviewTarget(record);
                          }}
                          disabled={!isFormUpload && !uploadUrl}
                          title={uploadName}
                        >
                          {uploadName}
                        </button>
                        {!isFormUpload && !supportsInlinePreview && uploadUrl ? (
                          <button
                            type="button"
                            className="mt-1 inline-flex h-5 w-full items-center justify-center rounded border border-slate-200 bg-white px-1 text-[10px] text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            onClick={() => triggerFileDownload(uploadUrl, uploadName)}
                            title={`Download ${uploadName}`}
                            aria-label={`Download ${uploadName}`}
                          >
                            Download
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-fixed w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="w-[15%] px-2 py-2">Type</th>
                      <th className="w-[40%] px-2 py-2">Name</th>
                      <th className="w-[25%] px-2 py-2">Customer Can View</th>
                      <th className="w-[20%] px-2 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!visibleExistingUploads.length ? (
                      <tr>
                        <td className="px-2 py-3 text-slate-400" colSpan={4}>
                          {formsEnabled && activeUploadsTab !== "all"
                            ? `No ${activeUploadsTab} uploads available.`
                            : "No uploads available."}
                        </td>
                      </tr>
                    ) : (
                      visibleExistingUploads.map((record, index) => {
                        const uploadId = String(record?.id || "").trim();
                        const uploadUrl = resolveUploadPreviewUrl(record);
                        const isFormUpload = isUploadFormRecord(record);
                        const isHighlighted =
                          Boolean(normalizedHighlightUploadId) &&
                          normalizeRecordId(uploadId) === normalizedHighlightUploadId;
                        return (
                          <tr
                            key={`${uploadId || uploadUrl || "upload"}-${index}`}
                            data-ann-kind="upload"
                            data-ann-id={normalizeRecordId(uploadId)}
                            data-ann-highlighted={isHighlighted ? "true" : "false"}
                            className={`border-b border-slate-100 last:border-b-0 ${
                              isHighlighted ? "bg-amber-50" : ""
                            }`}
                          >
                            <td className="px-2 py-3">{record?.type || "File"}</td>
                            <td className="px-2 py-3 break-all">{record?.name || "Upload"}</td>
                            <td className="px-2 py-3">
                              {!isFormUpload ? (
                                <button
                                  type="button"
                                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                                    record.customer_can_view
                                      ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                  }`}
                                  onClick={() => toggleCustomerCanView(record)}
                                  title={
                                    record.customer_can_view
                                      ? "Customer Can View: On — click to hide"
                                      : "Customer Can View: Off — click to make visible"
                                  }
                                  disabled={togglingCustomerCanViewId === uploadId}
                                >
                                  <CustomerEyeIcon active={record.customer_can_view} />
                                  {record.customer_can_view ? "On" : "Off"}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex w-full items-center justify-end gap-2">
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() => {
                                    if (isFormUpload) {
                                      openEditUploadForm(record);
                                      return;
                                    }
                                    if (!uploadUrl) return;
                                    window.open(uploadUrl, "_blank", "noopener,noreferrer");
                                  }}
                                  aria-label={isFormUpload ? "Edit form upload" : "View upload"}
                                  title={isFormUpload ? "Edit Form" : "View Upload"}
                                  disabled={!isFormUpload && !uploadUrl}
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() => setDeleteTarget(record)}
                                  aria-label="Delete upload"
                                  title="Delete Upload"
                                  disabled={!uploadId}
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {hasMoreExistingUploads ? (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Showing {visibleExistingUploads.length} of {filteredUploads.length} uploads
                </span>
                <Button type="button" variant="outline" onClick={showMoreExistingUploads}>
                  Load {Math.min(remainingExistingUploadsCount, 100)} more
                </Button>
              </div>
            ) : isExistingUploadsWindowed ? (
              <div className="text-xs text-slate-500">
                Showing all {filteredUploads.length} uploads.
              </div>
            ) : null}
          </>
        ) : null}
      </Card>
      ) : null}

      <Modal
        open={isUploadFormModalOpen}
        onClose={() => {
          if (isSavingUploadForm) return;
          setIsUploadFormModalOpen(false);
        }}
        title={`${editingUploadFormId ? "Edit" : "New"} ${activeUploadFormConfig.title}`}
        widthClass="max-w-[min(96vw,1040px)]"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsUploadFormModalOpen(false)}
              disabled={isSavingUploadForm}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={saveUploadForm}
              disabled={isSavingUploadForm}
            >
              {isSavingUploadForm ? "Saving..." : "Save Form"}
            </Button>
          </div>
        }
      >
        <div className="max-h-[76vh] space-y-3 overflow-y-auto pr-1">
          {activeUploadFormConfig.includeActivityDescription ? (
            <div className="rounded border border-slate-200 p-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Activity
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-[11px] font-medium text-slate-700">Activity Description</div>
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                    value={toText(uploadFormDraft.activity_description)}
                    onChange={(event) =>
                      handleUploadFormFieldChange("activity_description", event.target.value)
                    }
                  >
                    <option value="">Select Activity</option>
                    {PRESTART_ACTIVITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                {toText(uploadFormDraft.activity_description) === "Other" ? (
                  <label className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-700">Activity Other</div>
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                      value={String(uploadFormDraft.activity_other ?? "")}
                      onChange={(event) =>
                        handleUploadFormFieldChange("activity_other", event.target.value)
                      }
                      placeholder="Describe activity"
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded border border-slate-200 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Checklist
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {activeUploadFormConfig.checkboxFields.map((fieldName) => (
                <label
                  key={fieldName}
                  className="inline-flex items-start gap-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-700"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#003882] focus:ring-[#003882]"
                    checked={Boolean(uploadFormDraft[fieldName])}
                    onChange={(event) =>
                      handleUploadFormFieldChange(fieldName, event.target.checked)
                    }
                  />
                  <span>{humanizeFieldLabel(fieldName)}</span>
                </label>
              ))}
            </div>
          </div>

          {activeUploadFormConfig.numberFields.length ? (
            <div className="rounded border border-slate-200 p-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Quantities
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {activeUploadFormConfig.numberFields.map((fieldName) => (
                  <label key={fieldName} className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-700">
                      {humanizeFieldLabel(fieldName)}
                    </div>
                    <input
                      type="number"
                      step="any"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                      value={toText(uploadFormDraft[fieldName])}
                      onChange={(event) =>
                        handleUploadFormFieldChange(fieldName, event.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {activeUploadFormConfig.datetimeFields.length ? (
            <div className="rounded border border-slate-200 p-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Date & Time
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {activeUploadFormConfig.datetimeFields.map((fieldName) => (
                  <label key={fieldName} className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-700">
                      {humanizeFieldLabel(fieldName)}
                    </div>
                    <input
                      type="datetime-local"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                      value={toText(uploadFormDraft[fieldName])}
                      onChange={(event) =>
                        handleUploadFormFieldChange(fieldName, event.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {activeUploadFormConfig.textFields.length ? (
            <div className="rounded border border-slate-200 p-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Notes
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {activeUploadFormConfig.textFields.map((fieldName) => {
                  const isMultiline = activeUploadFormConfig.multilineTextFields.includes(
                    fieldName
                  );
                  return (
                    <label key={fieldName} className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-700">
                        {humanizeFieldLabel(fieldName)}
                      </div>
                      {isMultiline ? (
                        <textarea
                          rows={3}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                          value={String(uploadFormDraft[fieldName] ?? "")}
                          onChange={(event) =>
                            handleUploadFormFieldChange(fieldName, event.target.value)
                          }
                        />
                      ) : (
                        <input
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                          value={String(uploadFormDraft[fieldName] ?? "")}
                          onChange={(event) =>
                            handleUploadFormFieldChange(fieldName, event.target.value)
                          }
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        title={previewName || "Upload Preview"}
        widthClass="max-w-[min(96vw,1100px)]"
        footer={
          <div className="flex justify-end gap-2">
            {previewUrl && !previewSupportsInline ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => triggerFileDownload(previewUrl, previewName)}
              >
                Download
              </Button>
            ) : null}
            {previewUrl ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
              >
                Open in New Tab
              </Button>
            ) : null}
            <Button type="button" variant="primary" onClick={() => setPreviewTarget(null)}>
              Close
            </Button>
          </div>
        }
      >
        {!previewUrl ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            Preview is not available for this file.
          </div>
        ) : previewIsImage ? (
          <div className="rounded border border-slate-200 bg-slate-50 p-2">
            <img
              src={previewUrl}
              alt={previewName || "Upload preview"}
              className="mx-auto max-h-[72vh] w-auto rounded"
            />
          </div>
        ) : previewIsPdf ? (
          <iframe
            title={previewName || "Upload preview"}
            src={previewUrl}
            className="h-[72vh] w-full rounded border border-slate-200 bg-white"
          />
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <FileTypeIcon extension={previewExtension} />
            <div className="text-sm text-slate-600">Preview is not available for this file type.</div>
            <Button
              type="button"
              variant="primary"
              onClick={() => triggerFileDownload(previewUrl, previewName)}
            >
              Download File
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
        }}
        title="Delete Upload"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteUpload}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this upload?</p>
      </Modal>
    </section>
  );
}
