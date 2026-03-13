import {
  extractCancellationMessage,
  extractFromPayload,
  extractMutationErrorMessage,
  extractStatusFailure,
  fetchDirectWithTimeout,
  normalizeId,
} from "./_helpers.js";

export async function allocateServiceProviderForInquiry({
  plugin,
  inquiryId,
  serviceProviderId,
} = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedInquiryId = normalizeId(inquiryId);
  const normalizedProviderId = normalizeId(serviceProviderId);
  if (!normalizedInquiryId) {
    throw new Error("Inquiry ID is missing.");
  }
  if (!normalizedProviderId) {
    throw new Error("Service provider is required.");
  }

  const dealModel = plugin.switchTo("PeterpmDeal");
  const mutation = await dealModel.mutation();
  mutation.update((query) =>
    query.where("id", normalizedInquiryId).set({
      service_provider_id: normalizedProviderId,
    })
  );
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(
      extractCancellationMessage(result, "Service provider allocation was cancelled.")
    );
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) ||
        "Unable to allocate service provider."
    );
  }
  return { inquiryId: normalizedInquiryId, serviceProviderId: normalizedProviderId };
}

export async function updateJobFieldsById({ plugin, jobId, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedJobId = normalizeId(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is missing.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Update payload is missing.");
  }

  const jobModel = plugin.switchTo("PeterpmJob");
  const mutation = await jobModel.mutation();
  mutation.update((query) => query.where("id", normalizedJobId).set(payload));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Job update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update job."
    );
  }
  return { id: normalizedJobId, payload };
}

export async function updateInquiryFieldsById({ plugin, inquiryId, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedInquiryId = normalizeId(inquiryId);
  if (!normalizedInquiryId) {
    throw new Error("Inquiry ID is missing.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Update payload is missing.");
  }

  const dealModel = plugin.switchTo("PeterpmDeal");
  const mutation = await dealModel.mutation();
  mutation.update((query) => query.where("id", normalizedInquiryId).set(payload));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Inquiry update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update inquiry."
    );
  }
  return { id: normalizedInquiryId, payload };
}

export async function updateContactFieldsById({ plugin, contactId, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedContactId = normalizeId(contactId);
  if (!normalizedContactId) {
    throw new Error("Contact ID is missing.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Update payload is missing.");
  }

  const contactModel = plugin.switchTo("PeterpmContact");
  const mutation = await contactModel.mutation();
  mutation.update((query) => query.where("id", normalizedContactId).set(payload));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Contact update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update contact."
    );
  }
  return { id: normalizedContactId, payload };
}

export async function updateCompanyFieldsById({ plugin, companyId, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedCompanyId = normalizeId(companyId);
  if (!normalizedCompanyId) {
    throw new Error("Company ID is missing.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Update payload is missing.");
  }

  const companyModel = plugin.switchTo("PeterpmCompany");
  const mutation = await companyModel.mutation();
  mutation.update((query) => query.where("id", normalizedCompanyId).set(payload));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Company update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update company."
    );
  }
  return { id: normalizedCompanyId, payload };
}

export async function fetchContactsForLookup({ plugin } = {}) {
  if (!plugin?.switchTo) return [];

  try {
    const query = plugin
      .switchTo("PeterpmContact")
      .query()
      .deSelectAll()
      .select(["id", "first_name", "last_name", "email", "sms_number", "office_phone"])
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    const rows = extractFromPayload(payload);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error("[jobDetailsSdk] fetchContactsForLookup failed", error);
    return [];
  }
}
