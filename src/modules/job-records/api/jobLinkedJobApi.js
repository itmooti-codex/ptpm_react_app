import { toText } from "@shared/utils/formatters.js";
import {
  extractCancellationMessage,
  extractCreatedRecordId,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeId,
  normalizeDateInputToIso,
  normalizeStatus,
} from "./_helpers.js";
import { fetchJobById } from "./jobCoreApi.js";
import {
  fetchModelRecordByIdFields,
  recordHasExpectedValue,
  syncInquiryLinkedRecordsToQuoteJob,
  updateModelRecordFieldById,
} from "./_jobLinkSync.js";

export async function createLinkedJobForInquiry({
  plugin,
  inquiry,
  serviceProviderId,
  inquiryTakenById,
  quoteDate = "",
  followUpDate = "",
} = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  if (!inquiry || typeof inquiry !== "object") {
    throw new Error("Inquiry details are missing.");
  }

  const inquiryId = normalizeId(inquiry.id || inquiry.ID);
  if (!inquiryId) {
    throw new Error("Inquiry ID is missing.");
  }
  const inquiryUid = toText(inquiry.unique_id || inquiry.Unique_ID);

  const providerId =
    normalizeId(serviceProviderId) ||
    normalizeId(inquiry.service_provider_id || inquiry.Service_Provider_ID);
  const resolvedJobTakenById =
    normalizeId(inquiryTakenById) ||
    normalizeId(
      inquiry?.inquiry_taken_by_id || inquiry?.Inquiry_Taken_By_id || inquiry?.Inquiry_Taken_By_ID
    );

  const accountType = toText(inquiry.account_type || inquiry.Account_Type);
  const normalizedAccountType = normalizeStatus(accountType);
  const isContactAccount =
    normalizedAccountType === "contact" || normalizedAccountType === "individual";
  const isBodyCorpAccount = normalizedAccountType.includes("body corp");
  const isCompanyAccount =
    !isContactAccount &&
    (normalizedAccountType === "company" ||
      normalizedAccountType === "entity" ||
      normalizedAccountType.includes("company") ||
      isBodyCorpAccount);
  const propertyId = normalizeId(inquiry?.Property?.id || inquiry?.PropertyID || inquiry?.property_id);
  const contactId = normalizeId(
    inquiry?.Primary_Contact?.id ||
      inquiry?.Primary_Contact?.ID ||
      inquiry?.Primary_Contact_ID ||
      inquiry?.Primary_Contact_Contact_ID ||
      inquiry?.Contact_Contact_ID
  );
  const companyId = normalizeId(
    inquiry?.Company?.id ||
      inquiry?.Company?.ID ||
      inquiry?.company_id ||
      inquiry?.Company_ID ||
      inquiry?.CompanyID
  );
  const bodyCorpCompanyId = normalizeId(
    inquiry?.Company?.Body_Corporate_Company?.id ||
      inquiry?.Company?.Body_Corporate_Company?.ID ||
      inquiry?.CompanyID1 ||
      inquiry?.Company_ID1
  );
  const resolvedCompanyId = isBodyCorpAccount
    ? bodyCorpCompanyId || companyId
    : companyId;
  const useCompanyClient = isCompanyAccount
    ? Boolean(resolvedCompanyId)
    : !isContactAccount && Boolean(resolvedCompanyId) && !contactId;
  const resolvedClientEntityId = useCompanyClient ? resolvedCompanyId : "";
  const resolvedClientIndividualId = useCompanyClient ? "" : contactId;
  if (!resolvedClientEntityId && !resolvedClientIndividualId) {
    throw new Error("Unable to resolve client entity/contact for quote creation.");
  }
  const nowIso = new Date().toISOString();
  const normalizedQuoteDate = normalizeDateInputToIso(quoteDate);
  const normalizedFollowUpDate = normalizeDateInputToIso(followUpDate);
  const adminRecommendation = toText(
    inquiry?.admin_notes ||
      inquiry?.Admin_Notes ||
      inquiry?.admin_recommendation ||
      inquiry?.Admin_Recommendation
  );

  const payload = {
    inquiry_record_id: inquiryId,
    job_status: "Quote",
    quote_date: normalizedQuoteDate || nowIso,
    quote_status: "New",
    property_id: propertyId || null,
    account_type: accountType || null,
    client_individual_id: resolvedClientIndividualId || null,
    client_entity_id: resolvedClientEntityId || null,
  };
  if (providerId) {
    payload.primary_service_provider_id = providerId;
  }
  if (resolvedJobTakenById) {
    payload.job_taken_by_id = resolvedJobTakenById;
  }
  if (adminRecommendation) {
    payload.admin_recommendation = adminRecommendation;
  }
  if (normalizedFollowUpDate) {
    payload.follow_up_date = normalizedFollowUpDate;
  }

  const jobModel = plugin.switchTo("PeterpmJob");
  const createMutation = await jobModel.mutation();
  createMutation.createOne(payload);
  const createResult = await createMutation.execute(true).toPromise();
  if (!createResult || createResult?.isCancelling) {
    throw new Error(extractCancellationMessage(createResult, "Job create was cancelled."));
  }
  const createFailure = extractStatusFailure(createResult);
  if (createFailure) {
    throw new Error(
      extractMutationErrorMessage(createFailure.statusMessage) || "Unable to create job."
    );
  }

  const createdJobId = extractCreatedRecordId(createResult, "PeterpmJob");
  if (!isPersistedId(createdJobId)) {
    throw new Error("Job created but no persisted ID was returned.");
  }

  const dealModel = plugin.switchTo("PeterpmDeal");
  const linkMutation = await dealModel.mutation();
  linkMutation.update((query) =>
    query.where("id", inquiryId).set({
      inquiry_status: "Quote Created",
      quote_record_id: createdJobId,
      inquiry_for_job_id: createdJobId,
    })
  );
  const linkResult = await linkMutation.execute(true).toPromise();
  if (!linkResult || linkResult?.isCancelling) {
    throw new Error(extractCancellationMessage(linkResult, "Deal link update was cancelled."));
  }
  const linkFailure = extractStatusFailure(linkResult);
  if (linkFailure) {
    throw new Error(
      extractMutationErrorMessage(linkFailure.statusMessage) ||
        "Job created but failed to link inquiry."
    );
  }

  if (resolvedJobTakenById) {
    const takenByKeys = ["Job_Taken_By_id", "job_taken_by_id", "Job_Taken_By_ID"];
    let takenByApplied = false;
    let takenByError = null;
    for (const key of takenByKeys) {
      try {
        await updateModelRecordFieldById({
          plugin,
          modelName: "PeterpmJob",
          recordId: createdJobId,
          payload: { [key]: resolvedJobTakenById },
          fallbackErrorMessage: "Unable to update quote/job taken by.",
        });
        const verifyRecord = await fetchModelRecordByIdFields({
          plugin,
          modelName: "PeterpmJob",
          recordId: createdJobId,
          fields: ["Job_Taken_By_id", "job_taken_by_id", "Job_Taken_By_ID"],
        });
        if (
          !recordHasExpectedValue(
            verifyRecord,
            ["Job_Taken_By_id", "job_taken_by_id", "Job_Taken_By_ID"],
            resolvedJobTakenById
          )
        ) {
          throw new Error(`Verification failed while setting ${key} on created quote/job.`);
        }
        takenByApplied = true;
        break;
      } catch (error) {
        takenByError = error;
      }
    }
    if (!takenByApplied) {
      console.warn("[jobDetailsSdk] Failed setting job taken by ID on created quote/job", takenByError);
    }
  }

  try {
    await syncInquiryLinkedRecordsToQuoteJob({
      plugin,
      inquiryId,
      inquiryUid,
      jobId: createdJobId,
    });
  } catch (syncError) {
    console.warn("[jobDetailsSdk] Quote/job created but related record sync failed", syncError);
  }

  const createdJob = await fetchJobById({ plugin, jobId: createdJobId });
  if (!createdJob) {
    throw new Error("Job created but failed to load job details.");
  }
  return createdJob;
}
