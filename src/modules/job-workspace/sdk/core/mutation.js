import { fetchDirectWithTimeout } from "./transport.js";
import { findMutationData, findMutationDataByMatcher } from "../utils/sdkResponseUtils.js";
import { createSdkError, toCancelledMutationMessage } from "./errors.js";

export async function executeGraphMutation({
  query,
  operationName,
  fallbackErrorMessage = "Mutation failed.",
} = {}) {
  const response = await fetchDirectWithTimeout(query);
  const mutationResult = operationName
    ? findMutationData(response, operationName)
    : findMutationDataByMatcher(response, () => true);

  if (mutationResult !== null && mutationResult !== undefined) {
    return { response, mutationResult };
  }

  const cancelMessage = toCancelledMutationMessage(response, fallbackErrorMessage);
  throw createSdkError(cancelMessage, { response });
}
