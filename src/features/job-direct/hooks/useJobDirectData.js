import { useEffect, useState } from "react";
import { fetchJobDirectDataByUid } from "@modules/job-workspace/sdk/core/runtime.js";

export function useJobDirectData(jobUid, plugin) {
  const [jobData, setJobData] = useState(null);

  useEffect(() => {
    let isActive = true;

    async function load() {
      if (!jobUid) {
        setJobData(null);
        return;
      }

      if (!plugin) {
        setJobData(null);
        return;
      }

      const data = await fetchJobDirectDataByUid({ jobUid, plugin });
      if (!isActive) return;
      setJobData(data);
    }

    load().catch((error) => {
      if (!isActive) return;
      console.error("[JobDirect] Failed to load job data", error);
      setJobData(null);
    });

    return () => {
      isActive = false;
    };
  }, [jobUid, plugin]);

  return jobData;
}
