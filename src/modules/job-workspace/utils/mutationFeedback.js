import { extractMutationErrorMessage } from "../sdk/utils/sdkResponseUtils.js";

const FUNCTION_MESSAGE_PATTERN = /^function\s+[A-Za-z0-9_]+\s*\(/;

export function getUserFacingMutationError(errorValue, fallbackMessage) {
  const fallback = String(fallbackMessage || "Unable to complete this action right now.").trim();
  if (!errorValue) return fallback;

  const raw =
    typeof errorValue === "string"
      ? errorValue
      : String(
          errorValue?.publicErrorMessage ||
            errorValue?.statusMessage ||
            errorValue?.message ||
            ""
        );
  const normalized = extractMutationErrorMessage(raw);
  if (!normalized) return fallback;
  if (FUNCTION_MESSAGE_PATTERN.test(normalized)) return fallback;
  return normalized;
}

export function showMutationErrorToast(toastError, {
  title = "Save failed",
  error,
  fallbackMessage = "Unable to complete this action right now.",
} = {}) {
  const message = getUserFacingMutationError(error, fallbackMessage);
  if (typeof toastError === "function") {
    toastError(title, message);
  }
  return message;
}
