import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";

export function getJobUidFromSearch(search = "") {
  const params = new URLSearchParams(search || "");
  return (params.get("jobuid") || "").trim();
}

export function useJobUid() {
  const { jobuid } = useParams();
  const location = useLocation();

  return useMemo(() => {
    const fromPath = String(jobuid || "").trim();
    if (fromPath) return fromPath;
    return getJobUidFromSearch(location?.search || "");
  }, [jobuid, location?.search]);
}
