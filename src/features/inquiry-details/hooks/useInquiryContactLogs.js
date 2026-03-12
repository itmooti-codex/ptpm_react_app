import { useEffect, useState } from "react";
import { fetchContactLogsForDetails } from "../../../modules/job-records/exports/api.js";
import { toText } from "@shared/utils/formatters.js";

export function useInquiryContactLogs({
  plugin,
  isSdkReady,
  contactLogsContactId,
  enabled,
}) {
  const [contactLogs, setContactLogs] = useState([]);
  const [isContactLogsLoading, setIsContactLogsLoading] = useState(false);
  const [contactLogsError, setContactLogsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const normalizedContactId = toText(contactLogsContactId);

    if (!enabled) return undefined;

    if (!plugin || !isSdkReady || !normalizedContactId) {
      setContactLogs([]);
      setIsContactLogsLoading(false);
      setContactLogsError("");
      return undefined;
    }

    setIsContactLogsLoading(true);
    setContactLogsError("");

    fetchContactLogsForDetails({
      plugin,
      contactId: normalizedContactId,
    })
      .then((rows) => {
        if (cancelled) return;
        setContactLogs(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed to load contact logs", loadError);
        setContactLogs([]);
        setContactLogsError(loadError?.message || "Unable to load contact logs.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsContactLogsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contactLogsContactId, enabled, isSdkReady, plugin]);

  return {
    contactLogs,
    isContactLogsLoading,
    contactLogsError,
  };
}
