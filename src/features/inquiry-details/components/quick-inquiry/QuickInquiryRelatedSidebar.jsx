import { formatDate, toText } from "@shared/utils/formatters.js";
import { normalizeServiceInquiryId } from "../../shared/inquiryDetailsFormatting.js";

export function QuickInquiryRelatedSidebar({
  currentAccountType,
  currentMatchedAccountId,
  isRelatedLoading,
  relatedError,
  relatedInquiries,
  relatedJobs,
  serviceNameById,
}) {
  return (
    <aside className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        Related Data
      </div>
      <div className="text-xs text-slate-600">
        {currentMatchedAccountId
          ? `${currentAccountType} #${currentMatchedAccountId}`
          : "Related data appears after matching an existing contact/company."}
      </div>
      {isRelatedLoading ? (
        <div className="text-xs text-slate-500">Loading related records...</div>
      ) : null}
      {relatedError ? (
        <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {relatedError}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Past Inquiry As {currentAccountType}
        </div>
        {relatedInquiries.length ? (
          <div className="max-h-44 space-y-1.5 overflow-auto">
            {relatedInquiries.slice(0, 20).map((item) => {
              const uid = toText(item?.unique_id);
              const id = toText(item?.id);
              const linkUid = uid || id;
              if (!linkUid) return null;
              const serviceId = normalizeServiceInquiryId(item?.service_inquiry_id);
              const serviceName = toText(item?.service_name) || toText(serviceNameById[serviceId]);
              const dealName = toText(item?.deal_name);
              return (
                <div
                  key={`quick-related-inquiry-${uid || id}`}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5"
                >
                  <a
                    href={`/inquiry-details/${encodeURIComponent(linkUid)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-sky-700 underline underline-offset-2"
                  >
                    {linkUid}
                  </a>
                  {dealName ? <div className="text-[11px] text-slate-600">{dealName}</div> : null}
                  <div className="text-[11px] text-slate-600">
                    {formatDate(item?.created_at) || "-"}
                  </div>
                  <div className="text-[11px] text-slate-600">{toText(item?.type) || "-"}</div>
                  <div className="text-[11px] text-slate-600">
                    {serviceName || (serviceId ? `Service #${serviceId}` : "-")}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500">No past inquiries.</div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Past Jobs
        </div>
        {relatedJobs.length ? (
          <div className="max-h-44 space-y-1.5 overflow-auto">
            {relatedJobs.slice(0, 20).map((item) => {
              const uid = toText(item?.unique_id);
              const id = toText(item?.id);
              const linkUid = uid || id;
              if (!linkUid) return null;
              return (
                <div
                  key={`quick-related-job-${uid || id}`}
                  className="rounded border border-slate-200 bg-white px-2 py-1.5"
                >
                  <a
                    href={`/details/${encodeURIComponent(linkUid)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-sky-700 underline underline-offset-2"
                  >
                    {linkUid}
                  </a>
                  <div className="text-[11px] text-slate-600">
                    {toText(item?.property_name) || "-"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500">No past jobs.</div>
        )}
      </div>
    </aside>
  );
}
