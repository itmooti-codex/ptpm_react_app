import {
  createPropertyRecord,
  fetchPropertyAffiliationsByPropertyId,
  updatePropertyRecord,
} from "@modules/details-workspace/exports/api.js";
import { normalizeId } from "./_helpers.js";
import { updateInquiryFieldsById, updateJobFieldsById } from "./jobMutationsApi.js";

export async function fetchPropertyAffiliationsForDetails({ plugin, propertyId } = {}) {
  return fetchPropertyAffiliationsByPropertyId({ plugin, propertyId });
}

export async function savePropertyForDetails({
  plugin,
  propertyId,
  propertyPayload,
  inquiryId,
  jobId,
} = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const payload = propertyPayload && typeof propertyPayload === "object" ? propertyPayload : {};
  let resolvedPropertyId = normalizeId(propertyId) || normalizeId(payload?.id || payload?.ID);

  if (resolvedPropertyId) {
    await updatePropertyRecord({
      plugin,
      id: resolvedPropertyId,
      payload,
    });
  } else {
    const created = await createPropertyRecord({
      plugin,
      payload,
    });
    resolvedPropertyId = normalizeId(created?.id || created?.ID);
    if (!resolvedPropertyId) {
      throw new Error("Property saved but no ID was returned.");
    }
  }

  if (normalizeId(inquiryId)) {
    await updateInquiryFieldsById({
      plugin,
      inquiryId,
      payload: { property_id: resolvedPropertyId },
    });
  }

  if (normalizeId(jobId)) {
    await updateJobFieldsById({
      plugin,
      jobId,
      payload: { property_id: resolvedPropertyId },
    });
  }

  return resolvedPropertyId;
}
