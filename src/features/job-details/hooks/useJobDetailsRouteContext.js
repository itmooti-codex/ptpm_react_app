import { useMemo, useState } from "react";
import { toText } from "@shared/utils/formatters.js";

function pickJobStatusFromState(state = {}) {
  const candidates = [
    state?.job_Status,
    state?.job_status,
    state?.Job_Status,
    state?.status,
    state?.job?.job_Status,
    state?.job?.job_status,
    state?.job?.Job_Status,
    state?.job?.status,
    state?.record?.job_Status,
    state?.record?.job_status,
    state?.record?.Job_Status,
    state?.record?.status,
    state?.row?.job_Status,
    state?.row?.job_status,
    state?.row?.Job_Status,
    state?.row?.status,
  ];
  return candidates.map((value) => toText(value)).find(Boolean) || "";
}

export function useJobDetailsRouteContext({ location, uid = "" }) {
  const safeUid = toText(uid);
  const isNewJob = !safeUid || safeUid.toLowerCase() === "new";
  const configuredAdminProviderId = useMemo(
    () => toText(import.meta.env.VITE_APP_USER_ADMIN_ID),
    []
  );
  const routeJobStatus = useMemo(() => {
    const stateStatus = pickJobStatusFromState(location?.state || {});
    if (stateStatus) return stateStatus;
    const queryParams = new URLSearchParams(toText(location?.search));
    return toText(
      queryParams.get("job_Status") ||
        queryParams.get("job_status") ||
        queryParams.get("Job_Status") ||
        queryParams.get("status")
    );
  }, [location?.search, location?.state]);
  const jobNumericId = useMemo(() => {
    const state = location?.state || {};
    const stateJobId = [
      state?.jobId,
      state?.sourceId,
      state?.id,
      state?.job_id,
      state?.job?.id,
      state?.job?.ID,
      state?.record?.id,
      state?.record?.ID,
      state?.row?.id,
      state?.row?.ID,
    ]
      .map((value) => toText(value))
      .find(Boolean);
    if (stateJobId) return stateJobId;

    const queryParams = new URLSearchParams(toText(location?.search));
    return toText(queryParams.get("id") || queryParams.get("jobId") || queryParams.get("job_id"));
  }, [location?.search, location?.state]);
  const [resolvedJobId, setResolvedJobId] = useState("");
  const effectiveJobId = useMemo(
    () => toText(resolvedJobId || jobNumericId),
    [jobNumericId, resolvedJobId]
  );
  const externalJobUrl = useMemo(() => {
    if (!effectiveJobId) return "";
    return `https://app.ontraport.com/#!/o_jobs10000/edit&id=${encodeURIComponent(effectiveJobId)}`;
  }, [effectiveJobId]);

  return {
    configuredAdminProviderId,
    effectiveJobId,
    externalJobUrl,
    isNewJob,
    jobNumericId,
    resolvedJobId,
    routeJobStatus,
    safeUid,
    setResolvedJobId,
  };
}
