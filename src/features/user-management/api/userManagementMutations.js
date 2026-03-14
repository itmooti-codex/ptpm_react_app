import { fetchDirectWithTimeout, extractFromPayload } from "@shared/api/dashboardCore.js";
import {
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
} from "@modules/details-workspace/exports/api.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractCreatedRecordId(result, modelKey) {
  const managed = result?.mutations?.[modelKey]?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (isPersistedId(managedKey)) return String(managedKey);
      const nestedId = managedValue?.id || managedValue?.ID || "";
      if (isPersistedId(nestedId)) return String(nestedId);
    }
  }
  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const pkMap = item?.extensions?.pkMap || item?.pkMap;
    if (!pkMap || typeof pkMap !== "object") continue;
    for (const value of Object.values(pkMap)) {
      if (isPersistedId(value)) return String(value);
    }
  }
  return "";
}

// ─── Create User ─────────────────────────────────────────────────────────────

export async function createUser({ plugin, payload = {} } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const userModel = plugin.switchTo("PeterpmUser");
  const mutation = await userModel.mutation();
  mutation.createOne(payload);
  const result = await mutation.execute(true).toPromise();

  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "User create was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create user."
    );
  }

  const createdId = extractCreatedRecordId(result, "PeterpmUser");
  if (!isPersistedId(createdId)) {
    throw new Error("User created but no ID was returned.");
  }

  return { id: createdId };
}

// ─── Update User ─────────────────────────────────────────────────────────────

export async function updateUser({ plugin, userId, payload = {} } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  if (!userId) {
    throw new Error("User ID is required for update.");
  }

  const userModel = plugin.switchTo("PeterpmUser");
  const mutation = await userModel.mutation();
  mutation.update((query) => query.where("id", userId).set(payload));
  const result = await mutation.execute(true).toPromise();

  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "User update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update user."
    );
  }

  return { id: String(userId) };
}
