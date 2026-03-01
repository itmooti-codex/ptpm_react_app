import { extractCancellationMessage, extractMutationErrorMessage } from "../utils/sdkResponseUtils.js";

export function toSdkErrorMessage(error, fallback = "Unknown error.") {
  return extractMutationErrorMessage(error?.message || "") || String(fallback);
}

export function toCancelledMutationMessage(result, fallback = "Mutation was cancelled.") {
  return extractCancellationMessage(result, fallback);
}

export function createSdkError(message, context = {}) {
  const error = new Error(String(message || "Unknown SDK error."));
  Object.assign(error, context || {});
  return error;
}
