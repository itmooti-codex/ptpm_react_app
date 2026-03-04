import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import {
  useJobDirectSelector,
  useJobDirectStoreActions,
} from "../../../hooks/useJobDirectStore.jsx";
import { fetchLinkedDealsByAccount } from "../../../sdk/core/runtime.js";
import { selectLinkedInquiriesByAccountKey } from "../../../state/selectors.js";
import { InquiryOptionCard } from "./JobInfoOptionCards.jsx";
import {
  getJobRelatedInquiry,
  getLinkedRecordsCacheKey,
  normalizeInquiryId,
} from "./jobInfoUtils.js";

export function LinkInquiryCardSection({
  jobData,
  plugin,
  accountType,
  clientId,
  companyId,
  onInquiryRecordChange,
}) {
  const storeActions = useJobDirectStoreActions();
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const persistedRelatedInquiry = useMemo(() => getJobRelatedInquiry(jobData), [jobData]);
  const persistedInquiryId = normalizeInquiryId(persistedRelatedInquiry?.id);
  const [selectedInquiryId, setSelectedInquiryId] = useState(persistedInquiryId);

  const selectedAccountId = accountType === "Company" ? companyId : clientId;
  const inquiryCacheKey = useMemo(
    () => getLinkedRecordsCacheKey(accountType, selectedAccountId),
    [accountType, selectedAccountId]
  );
  const cachedDealsSelector = useCallback(
    (state) => selectLinkedInquiriesByAccountKey(state, inquiryCacheKey),
    [inquiryCacheKey]
  );
  const cachedDeals = useJobDirectSelector(cachedDealsSelector);
  const hasCachedDealsSelector = useCallback(
    (state) => {
      const key = String(inquiryCacheKey || "").trim();
      if (!key) return false;
      return Object.prototype.hasOwnProperty.call(
        state?.relations?.linkedInquiriesByAccount ?? {},
        key
      );
    },
    [inquiryCacheKey]
  );
  const hasCachedDeals = useJobDirectSelector(hasCachedDealsSelector);

  useEffect(() => {
    setSelectedInquiryId(persistedInquiryId);
  }, [persistedInquiryId]);

  const activeRelatedInquiry = useMemo(() => {
    const selected = deals.find(
      (deal) => normalizeInquiryId(deal?.id) === normalizeInquiryId(selectedInquiryId)
    );
    if (selected) return selected;

    if (
      persistedRelatedInquiry &&
      normalizeInquiryId(persistedRelatedInquiry.id) === normalizeInquiryId(selectedInquiryId)
    ) {
      return persistedRelatedInquiry;
    }

    if (!selectedInquiryId && persistedRelatedInquiry) return persistedRelatedInquiry;
    return selected || persistedRelatedInquiry || null;
  }, [deals, selectedInquiryId, persistedRelatedInquiry]);

  const effectiveInquiryId = normalizeInquiryId(
    selectedInquiryId || activeRelatedInquiry?.id || persistedInquiryId
  );

  useEffect(() => {
    onInquiryRecordChange?.(effectiveInquiryId || "");
  }, [effectiveInquiryId, onInquiryRecordChange]);

  useEffect(() => {
    let isActive = true;

    if (!plugin || !selectedAccountId) {
      setDeals([]);
      setLoadError("");
      setIsLoading(false);
      return undefined;
    }

    if (inquiryCacheKey && hasCachedDeals) {
      const cachedRecords = cachedDeals || [];
      setDeals(cachedRecords);
      setLoadError("");
      setIsLoading(false);
      const validIds = cachedRecords.map((item) => normalizeInquiryId(item.id)).filter(Boolean);
      setSelectedInquiryId((previous) => {
        const prev = normalizeInquiryId(previous);
        if (prev && validIds.includes(prev)) return prev;
        if (persistedInquiryId && validIds.includes(persistedInquiryId)) return persistedInquiryId;
        return prev || persistedInquiryId || "";
      });
      return undefined;
    }

    setIsLoading(true);
    setLoadError("");
    fetchLinkedDealsByAccount({
      plugin,
      accountType,
      accountId: selectedAccountId,
    })
      .then((records) => {
        if (!isActive) return;
        setDeals(records);
        if (inquiryCacheKey) {
          storeActions.replaceRelationCollection(
            "linkedInquiriesByAccount",
            inquiryCacheKey,
            records || []
          );
        }
        const validIds = records.map((item) => normalizeInquiryId(item.id)).filter(Boolean);
        setSelectedInquiryId((previous) => {
          const prev = normalizeInquiryId(previous);
          if (prev && validIds.includes(prev)) return prev;
          if (persistedInquiryId && validIds.includes(persistedInquiryId)) return persistedInquiryId;
          return prev || persistedInquiryId || "";
        });
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("[JobDirect] Failed loading linked inquiries", error);
        setDeals([]);
        setLoadError("Unable to load linked inquiries.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    plugin,
    accountType,
    selectedAccountId,
    persistedInquiryId,
    inquiryCacheKey,
    cachedDeals,
    hasCachedDeals,
    storeActions,
  ]);

  return (
    <Card className="h-fit space-y-4">
      <input type="hidden" data-field="inquiry_record_id" value={effectiveInquiryId} readOnly />

      {activeRelatedInquiry ? (
        <div className="space-y-2">
          <div className="text-base font-bold leading-4 text-neutral-700">Related Inquiry</div>
          <InquiryOptionCard
            deal={activeRelatedInquiry}
            isSelected
            readOnly
            radioName="related-inquiry"
          />
        </div>
      ) : null}

      {activeRelatedInquiry ? <div className="border-t border-slate-200" /> : null}

      <div className="text-base font-bold leading-4 text-neutral-700">Link Inquiry</div>

      {!selectedAccountId ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Select a {accountType === "Company" ? "company" : "contact"} to view linked inquiries.
        </div>
      ) : null}

      {selectedAccountId && isLoading ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Loading linked inquiries...
        </div>
      ) : null}

      {selectedAccountId && !isLoading && loadError ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {selectedAccountId && !isLoading && !loadError && !deals.length ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          No linked inquiries found.
        </div>
      ) : null}

      {selectedAccountId && !isLoading && !loadError && deals.length ? (
        <div className="space-y-2">
          {deals.map((deal, index) => {
            const dealId = normalizeInquiryId(deal.id);
            const isSelected = normalizeInquiryId(selectedInquiryId) === dealId;
            return (
              <InquiryOptionCard
                key={`${dealId || deal.unique_id || "deal"}-${index}`}
                deal={deal}
                isSelected={isSelected}
                radioName="linked-inquiry"
                onSelect={setSelectedInquiryId}
              />
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}
