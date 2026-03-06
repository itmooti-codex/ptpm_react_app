import { parseUploadFileObject } from "../shared/sharedHelpers.js";

export const PRESTART_FORM_FIELD_KEYS = [
  "activity_description",
  "activity_other",
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
  "write_your_name",
  "potential_hazard",
  "action_control",
];

export const PCA_FORM_FIELD_KEYS = [
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
  "plastic_bait_station_where_and_number",
  "other_place_description_and_number",
  "other_pest",
  "technicians_comments",
  "time_sent_to_occupant_owner",
];

export const UPLOAD_FORM_FIELD_KEYS = Array.from(
  new Set([...PRESTART_FORM_FIELD_KEYS, ...PCA_FORM_FIELD_KEYS])
);

export const UPLOAD_RECORD_SELECT_FIELDS = [
  "id",
  "photo_upload",
  "file_upload",
  "type",
  "file_name",
  "photo_name",
  "created_at",
  "property_name_id",
  "job_id",
  "inquiry_id",
  ...UPLOAD_FORM_FIELD_KEYS,
];

const FALLBACK_UPLOAD_SELECT_FIELDS = [
  ["ID", "id"],
  ["File_Upload", "file_upload"],
  ["Type", "type"],
  ["Photo_Upload", "photo_upload"],
  ["File_Name", "file_name"],
  ["Photo_Name", "photo_name"],
  ["Created_At", "created_at"],
  ["Property_Name_ID", "property_name_id"],
  ["Job_ID", "job_id"],
  ["Inquiry_ID", "inquiry_id"],
  ...UPLOAD_FORM_FIELD_KEYS.map((fieldName) => [fieldName, fieldName]),
];

function buildFallbackSelectFields() {
  return FALLBACK_UPLOAD_SELECT_FIELDS.map(
    ([alias, fieldName]) => `        ${alias}: field(arg: ["${fieldName}"])`
  ).join("\n");
}

function readFieldWithCaseFallback(rawUpload = {}, fieldName = "") {
  const key = String(fieldName || "").trim();
  if (!key) return undefined;
  const pascalCase = key
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("_");
  if (rawUpload?.[key] !== undefined) return rawUpload[key];
  if (rawUpload?.[pascalCase] !== undefined) return rawUpload[pascalCase];
  return undefined;
}

function extractFileNameFromUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    const clean = value.split("?")[0];
    const parts = clean.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "");
  } catch {
    return "";
  }
}

export function isImageUpload(fileType = "", fileName = "", uploadType = "") {
  if (/photo/i.test(String(uploadType || ""))) return true;
  if (/^image\//i.test(String(fileType || "").trim())) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(String(fileName || "").trim());
}

export function normalizeUploadRecord(rawUpload = {}) {
  const id = String(rawUpload?.id || rawUpload?.ID || "").trim();
  const uploadType = String(rawUpload?.type || rawUpload?.Type || "").trim();
  const photoUpload = String(rawUpload?.photo_upload || rawUpload?.Photo_Upload || "").trim();
  const fileUploadObj = parseUploadFileObject(rawUpload?.file_upload || rawUpload?.File_Upload);
  const fileUploadUrl = String(fileUploadObj?.link || fileUploadObj?.url || "").trim();
  const url = photoUpload || fileUploadUrl;

  const explicitFileName = String(
    rawUpload?.file_name ||
      rawUpload?.File_Name ||
      rawUpload?.photo_name ||
      rawUpload?.Photo_Name ||
      fileUploadObj?.name ||
      ""
  ).trim();
  const derivedFileName = explicitFileName || extractFileNameFromUrl(url) || "Upload";
  const mime = String(fileUploadObj?.type || "").trim();
  const isPhoto = isImageUpload(mime, derivedFileName, uploadType) || Boolean(photoUpload);
  const formFields = {};
  UPLOAD_FORM_FIELD_KEYS.forEach((fieldName) => {
    formFields[fieldName] = readFieldWithCaseFallback(rawUpload, fieldName);
  });

  return {
    id,
    type: uploadType || (isPhoto ? "Photo" : "File"),
    photo_upload: photoUpload,
    file_upload: fileUploadObj,
    url,
    name: derivedFileName,
    file_type: mime,
    created_at: rawUpload?.created_at || rawUpload?.Created_At || "",
    property_name_id: String(
      rawUpload?.property_name_id || rawUpload?.Property_Name_ID || ""
    ).trim(),
    inquiry_id: String(rawUpload?.inquiry_id || rawUpload?.Inquiry_ID || "").trim(),
    job_id: String(rawUpload?.job_id || rawUpload?.Job_ID || "").trim(),
    ...formFields,
  };
}

export function buildUploadsByFieldFallbackQuery({
  fieldName,
  variableName,
  variableType,
} = {}) {
  const selectFields = buildFallbackSelectFields();
  return `
    query calcUploads($${variableName}: ${variableType}!) {
      calcUploads(query: [{ where: { ${fieldName}: $${variableName} } }]) {
${selectFields}
      }
    }
  `;
}

export function buildUploadPayloadFromSignedFile({
  fieldName,
  normalizedId,
  file,
  signed,
  additionalPayload,
} = {}) {
  const isPhoto = isImageUpload(file?.type || "", file?.name || "", "");
  const extraPayload =
    additionalPayload && typeof additionalPayload === "object" ? additionalPayload : {};

  return {
    ...extraPayload,
    [fieldName]: normalizedId,
    type: isPhoto ? "Photo" : "File",
    photo_upload: isPhoto ? signed.url : "",
    file_upload: isPhoto
      ? ""
      : {
          link: signed.url,
          name: file?.name || "",
          size: file?.size || "",
          type: file?.type || "",
          s3_id: signed?.key || "",
        },
    file_name: isPhoto ? "" : file?.name || "",
    photo_name: isPhoto ? file?.name || "" : "",
  };
}
