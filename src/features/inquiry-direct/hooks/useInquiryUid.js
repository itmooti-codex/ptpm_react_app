import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";

export function getInquiryUidFromSearch(search = "") {
  const params = new URLSearchParams(search || "");
  return (params.get("inquiryuid") || "").trim();
}

export function useInquiryUid() {
  const { inquiryuid } = useParams();
  const location = useLocation();

  return useMemo(() => {
    const fromPath = String(inquiryuid || "").trim();
    if (fromPath) return fromPath;
    return getInquiryUidFromSearch(location?.search || "");
  }, [inquiryuid, location?.search]);
}
