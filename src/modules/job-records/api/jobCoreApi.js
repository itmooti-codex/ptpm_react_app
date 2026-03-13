import { toText } from "@shared/utils/formatters.js";
import {
  fetchDirectWithTimeout,
  firstRecord,
  normalizeId,
} from "./_helpers.js";
import {
  buildInquiryBaseQuery,
  buildJobBaseQuery,
  mapInquiryRecord,
  mapJobRecord,
} from "./_queryBuilders.js";

export { buildJobBaseQuery, mapJobRecord };

export async function fetchInquiryByUid({ plugin, uid } = {}) {
  if (!plugin?.switchTo) return null;
  const uniqueId = toText(uid);
  if (!uniqueId) return null;
  try {
    const query = buildInquiryBaseQuery(plugin).where("unique_id", uniqueId).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapInquiryRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchInquiryByUid failed", error);
    return null;
  }
}

export async function fetchJobByUid({ plugin, uid } = {}) {
  if (!plugin?.switchTo) return null;
  const uniqueId = toText(uid);
  if (!uniqueId) return null;
  try {
    const query = buildJobBaseQuery(plugin).where("unique_id", uniqueId).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapJobRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchJobByUid failed", error);
    return null;
  }
}

export async function fetchInquiryById({ plugin, inquiryId } = {}) {
  const id = normalizeId(inquiryId);
  if (!id) return null;
  try {
    const query = buildInquiryBaseQuery(plugin).where("id", id).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapInquiryRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchInquiryById failed", error);
    return null;
  }
}

export async function fetchJobById({ plugin, jobId } = {}) {
  const id = normalizeId(jobId);
  if (!id) return null;
  try {
    const query = buildJobBaseQuery(plugin).where("id", id).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapJobRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchJobById failed", error);
    return null;
  }
}

async function fetchDealByJobLinkField({ plugin, field, jobId } = {}) {
  const id = normalizeId(jobId);
  if (!id) return null;
  try {
    const query = buildInquiryBaseQuery(plugin).where(field, id).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 15000);
    return mapInquiryRecord(firstRecord(payload));
  } catch (error) {
    return null;
  }
}

export async function fetchLinkedJobForInquiry({ plugin, inquiry } = {}) {
  if (!plugin?.switchTo || !inquiry) return null;
  const directJobId =
    normalizeId(inquiry.quote_record_id) || normalizeId(inquiry.inquiry_for_job_id);
  if (directJobId) {
    const directJob = await fetchJobById({ plugin, jobId: directJobId });
    if (directJob) return directJob;
  }

  const inquiryId = normalizeId(inquiry.id);
  if (!inquiryId) return null;

  try {
    const query = buildJobBaseQuery(plugin)
      .where("inquiry_record_id", inquiryId)
      .orderBy("created_at", "desc")
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapJobRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchLinkedJobForInquiry failed", error);
    return null;
  }
}

export async function fetchLinkedInquiryForJob({ plugin, job } = {}) {
  if (!plugin?.switchTo || !job) return null;

  const inquiryId = normalizeId(job.inquiry_record_id);
  if (inquiryId) {
    const linked = await fetchInquiryById({ plugin, inquiryId });
    if (linked) return linked;
  }

  const jobId = normalizeId(job.id);
  if (!jobId) return null;

  const byInquiryForJob = await fetchDealByJobLinkField({
    plugin,
    field: "inquiry_for_job_id",
    jobId,
  });
  if (byInquiryForJob) return byInquiryForJob;

  const byQuoteRecord = await fetchDealByJobLinkField({
    plugin,
    field: "quote_record_id",
    jobId,
  });
  if (byQuoteRecord) return byQuoteRecord;

  return null;
}

export async function resolveJobDetailsContext({
  plugin,
  uid,
  sourceTab = "",
} = {}) {
  const normalizedUid = toText(uid);
  const normalizedSource = toText(sourceTab).toLowerCase();
  const inquiryFirst = normalizedSource === "inquiry";

  let inquiry = null;
  let job = null;

  if (inquiryFirst) {
    inquiry = await fetchInquiryByUid({ plugin, uid: normalizedUid });
    job = await fetchJobByUid({ plugin, uid: normalizedUid });
  } else {
    job = await fetchJobByUid({ plugin, uid: normalizedUid });
    inquiry = await fetchInquiryByUid({ plugin, uid: normalizedUid });
  }

  if (inquiry && !job) {
    job = await fetchLinkedJobForInquiry({ plugin, inquiry });
  }

  if (job && !inquiry) {
    inquiry = await fetchLinkedInquiryForJob({ plugin, job });
  }

  const found = Boolean(inquiry || job);
  const primaryType =
    inquiryFirst && inquiry
      ? "inquiry"
      : !inquiryFirst && job
        ? "job"
        : inquiry
          ? "inquiry"
          : job
            ? "job"
            : "";

  return {
    found,
    primaryType,
    inquiry: inquiry || null,
    job: job || null,
  };
}
