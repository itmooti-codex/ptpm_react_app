import { parseUploadFileObject } from "../shared/sharedHelpers.js";

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
];

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
  };
}

export function buildUploadsByFieldFallbackQuery({
  fieldName,
  variableName,
  variableType,
} = {}) {
  return `
    query calcUploads($${variableName}: ${variableType}!) {
      calcUploads(query: [{ where: { ${fieldName}: $${variableName} } }]) {
        ID: field(arg: ["id"])
        File_Upload: field(arg: ["file_upload"])
        Type: field(arg: ["type"])
        Photo_Upload: field(arg: ["photo_upload"])
        File_Name: field(arg: ["file_name"])
        Photo_Name: field(arg: ["photo_name"])
        Created_At: field(arg: ["created_at"])
        Property_Name_ID: field(arg: ["property_name_id"])
        Job_ID: field(arg: ["job_id"])
        Inquiry_ID: field(arg: ["inquiry_id"])
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
