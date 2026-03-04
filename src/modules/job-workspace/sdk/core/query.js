import { fetchDirectWithTimeout, subscribeToQueryStream } from "./transport.js";
import { extractFirstRecord, extractRecords } from "../utils/sdkResponseUtils.js";

export async function fetchQueryFirst(query, { timeoutMs = 10000 } = {}) {
  const response = await fetchDirectWithTimeout(query, null, timeoutMs);
  return extractFirstRecord(response);
}

export async function fetchQueryRecords(query, { timeoutMs = 10000 } = {}) {
  const response = await fetchDirectWithTimeout(query, null, timeoutMs);
  return extractRecords(response);
}

export function subscribeQuery(query, { onNext, onError } = {}) {
  return subscribeToQueryStream(query, { onNext, onError });
}
