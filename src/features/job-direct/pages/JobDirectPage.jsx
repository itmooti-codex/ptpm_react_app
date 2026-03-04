import { useEffect } from "react";
import { JobDirectLayout } from "@modules/job-workspace/components/layout/JobDirectLayout.jsx";
import { useJobDirectBootstrap } from "../hooks/useJobDirectBootstrap.js";
import { JobDirectStoreProvider } from "@modules/job-workspace/hooks/useJobDirectStore.jsx";
import { useJobUid } from "../hooks/useJobUid.js";
import { useVitalStatsPlugin } from "@platform/vitalstats/useVitalStatsPlugin.js";
import { getFriendlyServiceMessage } from "../../../shared/utils/userFacingErrors.js";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";

function FullPageLoader({ title = "Loading job...", description = "" }) {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
            <div className="text-sm font-semibold text-slate-800">{title}</div>
          </div>
          <p className="mt-3 text-sm text-slate-500">{description || "Preparing data..."}</p>
        </div>
      </div>
    </main>
  );
}

function FullPageError({ title = "Unable to load job page.", description = "" }) {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-red-700">{title}</div>
          <p className="mt-3 text-sm text-slate-600">{description || "Please try refreshing the page."}</p>
        </div>
      </div>
    </main>
  );
}

export function JobDirectPage() {
  const jobUid = useJobUid();
  const { plugin, isReady: isSdkReady, error: sdkError } = useVitalStatsPlugin();
  const {
    isBootstrapping,
    statusText,
    error: bootstrapError,
    jobData,
    lookupData,
  } = useJobDirectBootstrap({
    jobUid,
    plugin,
    isSdkReady,
    sdkError,
  });
  const jobStatus =
    jobData?.job_status ??
    jobData?.jobStatus ??
    jobData?.Job_Status ??
    jobData?.status ??
    null;

  useEffect(() => {
    if (bootstrapError) {
      console.error("[JobDirect] Bootstrap error. Job page load skipped.", bootstrapError);
      return;
    }

    if (!jobUid || !isSdkReady || !jobData) return;

    console.log(`[JobDirect] jobuid="${jobUid}" | job_status="${jobStatus ?? ""}"`, jobData);
  }, [jobUid, isSdkReady, bootstrapError, jobData, jobStatus]);

  if (!jobUid) {
    return (
      <FullPageError
        title="Missing job UID."
        description='Open `/job-direct/JOB_UID` or add `?jobuid=JOB_UID` in the URL.'
      />
    );
  }

  if (bootstrapError) {
    const friendlyMessage = getFriendlyServiceMessage(bootstrapError);
    return (
      <FullPageError
        title={friendlyMessage ? "Temporary maintenance" : "Unable to load job data."}
        description={friendlyMessage || "Please refresh and try again."}
      />
    );
  }

  if (!isSdkReady || isBootstrapping) {
    return (
      <FullPageLoader
        title="Loading job page..."
        description={statusText || "Preparing data..."}
      />
    );
  }

  return (
    <>
      <GlobalTopHeader />
      <main
        className="min-h-screen w-full bg-slate-50 font-['Inter']"
        data-page="new-direct-job"
        data-jobuid={jobUid || ""}
        data-sdk-ready={isSdkReady ? "true" : "false"}
        data-job-loaded={jobData ? "true" : "false"}
      >
        <JobDirectStoreProvider
          jobUid={jobUid}
          jobData={jobData}
          lookupData={lookupData}
        >
          <JobDirectLayout
            jobData={jobData}
            plugin={plugin}
            jobUid={jobUid}
            preloadedLookupData={lookupData}
          />
        </JobDirectStoreProvider>
      </main>
    </>
  );
}
