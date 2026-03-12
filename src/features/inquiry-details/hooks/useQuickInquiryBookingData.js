import { useEffect, useMemo, useRef } from "react";
import { fetchServicesForActivities, findPropertyByName } from "../../../modules/details-workspace/api/core/runtime.js";
import { isLikelyEmailValue } from "@shared/utils/accountTypeUtils.js";
import { toText } from "@shared/utils/formatters.js";
import { isPestServiceFlow } from "../shared/pestRules.js";
import { normalizeServiceInquiryId } from "../shared/inquiryDetailsFormatting.js";
import { normalizeRelationRecord } from "../shared/inquiryDetailsRecordHelpers.js";
import {
  normalizeComparablePropertyName,
  resolveLookupRecordId,
} from "../shared/quickInquiryHelpers.js";
import { fetchCompanyByExactName, fetchContactByExactEmail } from "../api/inquiryLookupApi.js";
import {
  fetchQuickRelatedInquiriesByAccount,
  fetchQuickRelatedJobsByAccount,
} from "../api/inquiryRelatedRecordsApi.js";

export function useQuickInquiryBookingData({
  accountMode,
  companyForm,
  companyMatchState,
  contactMatchState,
  detailsForm,
  individualForm,
  inquiryFlowRule,
  open,
  plugin,
  serviceOptions,
  setCompanyForm,
  setCompanyMatchState,
  setContactMatchState,
  setIndividualForm,
  setIsRelatedLoading,
  setIsServiceOptionsLoading,
  setPropertyMatchState,
  setRelatedError,
  setRelatedInquiries,
  setRelatedJobs,
  setServiceOptions,
  standardizedPropertyName,
}) {
  const contactLookupRequestRef = useRef(0);
  const companyLookupRequestRef = useRef(0);
  const propertyLookupRequestRef = useRef(0);

  const currentAccountType = accountMode === "company" ? "Company" : "Contact";
  const currentMatchedAccountId = useMemo(
    () =>
      accountMode === "company"
        ? resolveLookupRecordId(companyMatchState.record, "Company")
        : resolveLookupRecordId(contactMatchState.record, "Contact"),
    [accountMode, companyMatchState.record, contactMatchState.record]
  );
  const serviceNameById = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(serviceOptions) ? serviceOptions : []).map((option) => [
          toText(option?.value),
          toText(option?.label),
        ])
      ),
    [serviceOptions]
  );
  const selectedQuickServiceInquiryLabel = useMemo(() => {
    const selectedServiceId = normalizeServiceInquiryId(detailsForm.service_inquiry_id);
    if (!selectedServiceId) return "";
    return toText(
      serviceNameById[selectedServiceId] ||
        (Array.isArray(serviceOptions)
          ? serviceOptions.find((option) => toText(option?.value) === selectedServiceId)?.label
          : "")
    );
  }, [detailsForm.service_inquiry_id, serviceNameById, serviceOptions]);
  const isQuickPestServiceSelected = useMemo(
    () => isPestServiceFlow(selectedQuickServiceInquiryLabel),
    [selectedQuickServiceInquiryLabel]
  );

  useEffect(() => {
    if (!open || !plugin) return;

    let cancelled = false;
    setIsServiceOptionsLoading(true);
    fetchServicesForActivities({ plugin })
      .then((records) => {
        if (cancelled) return;
        const mapped = (Array.isArray(records) ? records : [])
          .map((record) => ({
            value: toText(record?.id || record?.ID),
            label: toText(record?.service_name || record?.Service_Name),
            type: toText(record?.service_type || record?.Service_Type),
            parentId: toText(record?.primary_service_id || record?.Primary_Service_ID),
          }))
          .filter((record) => {
            if (!record.value || !record.label) return false;
            if (record.parentId && record.parentId !== record.value) return false;
            if (/option/i.test(record.type)) return false;
            return true;
          })
          .sort((left, right) => left.label.localeCompare(right.label));
        setServiceOptions(mapped);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[QuickInquiry] Failed loading service options", loadError);
        setServiceOptions([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsServiceOptionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, plugin, setIsServiceOptionsLoading, setServiceOptions]);

  useEffect(() => {
    if (!open || !plugin || accountMode !== "individual") {
      setContactMatchState({ status: "idle", message: "", record: null });
      return;
    }
    const email = toText(individualForm.email);
    if (!email) {
      setContactMatchState({ status: "idle", message: "", record: null });
      return;
    }
    if (!isLikelyEmailValue(email)) {
      setContactMatchState({
        status: "invalid",
        message: "Enter a valid email format to run a duplicate check.",
        record: null,
      });
      return;
    }

    const requestId = ++contactLookupRequestRef.current;
    setContactMatchState({
      status: "checking",
      message: "Checking for existing contact...",
      record: null,
    });
    const timeoutId = window.setTimeout(() => {
      fetchContactByExactEmail({ plugin, email })
        .then((matchedRecord) => {
          if (requestId !== contactLookupRequestRef.current) return;
          if (!matchedRecord) {
            setContactMatchState({
              status: "not-found",
              message: "No contact found with this email. Proceed to create a new contact.",
              record: null,
            });
            return;
          }
          setContactMatchState({
            status: "found",
            message: "This contact already exists. Proceed with this email.",
            record: matchedRecord,
          });
          setIndividualForm((previous) => ({
            ...previous,
            first_name: toText(
              matchedRecord?.first_name || matchedRecord?.First_Name || previous.first_name
            ),
            last_name: toText(
              matchedRecord?.last_name || matchedRecord?.Last_Name || previous.last_name
            ),
            sms_number: toText(
              matchedRecord?.sms_number || matchedRecord?.SMS_Number || previous.sms_number
            ),
            address: toText(matchedRecord?.address || matchedRecord?.Address || previous.address),
            city: toText(matchedRecord?.city || matchedRecord?.City || previous.city),
            state: toText(matchedRecord?.state || matchedRecord?.State || previous.state),
            zip_code: toText(
              matchedRecord?.zip_code || matchedRecord?.Zip_Code || previous.zip_code
            ),
            country: toText(
              matchedRecord?.country || matchedRecord?.Country || previous.country || "AU"
            ),
          }));
        })
        .catch((lookupError) => {
          if (requestId === contactLookupRequestRef.current) {
            console.error("[QuickInquiry] Contact lookup failed", lookupError);
            setContactMatchState({
              status: "error",
              message: lookupError?.message || "Unable to verify contact email.",
              record: null,
            });
          }
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [accountMode, individualForm.email, open, plugin, setContactMatchState, setIndividualForm]);

  useEffect(() => {
    if (!open || !plugin || accountMode !== "company") {
      setCompanyMatchState({ status: "idle", message: "", record: null });
      return;
    }
    const companyName = toText(companyForm.company_name);
    if (!companyName) {
      setCompanyMatchState({ status: "idle", message: "", record: null });
      return;
    }

    const requestId = ++companyLookupRequestRef.current;
    setCompanyMatchState({
      status: "checking",
      message: "Checking for existing company...",
      record: null,
    });
    const timeoutId = window.setTimeout(() => {
      fetchCompanyByExactName({ plugin, companyName })
        .then((matchedRecord) => {
          if (requestId !== companyLookupRequestRef.current) return;
          if (!matchedRecord) {
            setCompanyMatchState({
              status: "not-found",
              message: "No company found with this name. Proceed to create a new company.",
              record: null,
            });
            return;
          }
          setCompanyMatchState({
            status: "found",
            message: "This company already exists. Proceed with this company.",
            record: matchedRecord,
          });
          const primaryPerson = normalizeRelationRecord(
            matchedRecord?.Primary_Person || matchedRecord?.primary_person
          );
          setCompanyForm((previous) => ({
            ...previous,
            company_phone: toText(
              matchedRecord?.phone || matchedRecord?.Phone || previous.company_phone
            ),
            company_address: toText(
              matchedRecord?.address || matchedRecord?.Address || previous.company_address
            ),
            company_city: toText(
              matchedRecord?.city || matchedRecord?.City || previous.company_city
            ),
            company_state: toText(
              matchedRecord?.state || matchedRecord?.State || previous.company_state
            ),
            company_postal_code: toText(
              matchedRecord?.postal_code ||
                matchedRecord?.Postal_Code ||
                previous.company_postal_code
            ),
            company_account_type: toText(
              matchedRecord?.account_type ||
                matchedRecord?.Account_Type ||
                previous.company_account_type
            ),
            primary_first_name: toText(
              primaryPerson?.first_name || primaryPerson?.First_Name || previous.primary_first_name
            ),
            primary_last_name: toText(
              primaryPerson?.last_name || primaryPerson?.Last_Name || previous.primary_last_name
            ),
            primary_email: toText(
              primaryPerson?.email || primaryPerson?.Email || previous.primary_email
            ),
            primary_sms_number: toText(
              primaryPerson?.sms_number || primaryPerson?.SMS_Number || previous.primary_sms_number
            ),
          }));
        })
        .catch((lookupError) => {
          if (requestId === companyLookupRequestRef.current) {
            console.error("[QuickInquiry] Company lookup failed", lookupError);
            setCompanyMatchState({
              status: "error",
              message: lookupError?.message || "Unable to verify company name.",
              record: null,
            });
          }
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [accountMode, companyForm.company_name, open, plugin, setCompanyForm, setCompanyMatchState]);

  useEffect(() => {
    if (!open || !plugin || !inquiryFlowRule.showPropertySearch) {
      setPropertyMatchState({ status: "idle", message: "", record: null });
      return;
    }
    const propertyNameToMatch = toText(
      standardizedPropertyName || detailsForm.property_name || detailsForm.property_lookup
    );
    if (!propertyNameToMatch) {
      setPropertyMatchState({ status: "idle", message: "", record: null });
      return;
    }
    const comparableTarget = normalizeComparablePropertyName(propertyNameToMatch);

    const requestId = ++propertyLookupRequestRef.current;
    setPropertyMatchState({
      status: "checking",
      message: "Checking for existing property...",
      record: null,
    });
    const timeoutId = window.setTimeout(() => {
      findPropertyByName({ plugin, propertyName: propertyNameToMatch })
        .then((matchedRecord) => {
          if (requestId !== propertyLookupRequestRef.current) return;
          const comparableFound = normalizeComparablePropertyName(
            matchedRecord?.property_name || matchedRecord?.Property_Name
          );
          const hasExactMatch =
            Boolean(matchedRecord) &&
            Boolean(comparableTarget) &&
            comparableFound === comparableTarget;
          if (!hasExactMatch) {
            setPropertyMatchState({
              status: "not-found",
              message:
                "No exact property-name match found. A new property will be created on save.",
              record: null,
            });
            return;
          }
          setPropertyMatchState({
            status: "found",
            message: "Property already exists and will be linked.",
            record: matchedRecord,
          });
        })
        .catch((lookupError) => {
          if (requestId === propertyLookupRequestRef.current) {
            console.error("[QuickInquiry] Property lookup failed", lookupError);
            setPropertyMatchState({
              status: "error",
              message: lookupError?.message || "Unable to verify property name.",
              record: null,
            });
          }
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    detailsForm.property_lookup,
    detailsForm.property_name,
    inquiryFlowRule.showPropertySearch,
    open,
    plugin,
    setPropertyMatchState,
    standardizedPropertyName,
  ]);

  useEffect(() => {
    if (!open || !plugin || !currentMatchedAccountId) {
      setRelatedInquiries([]);
      setRelatedJobs([]);
      setRelatedError("");
      setIsRelatedLoading(false);
      return;
    }
    let cancelled = false;
    setIsRelatedLoading(true);
    setRelatedError("");

    Promise.all([
      fetchQuickRelatedInquiriesByAccount({
        plugin,
        accountType: currentAccountType,
        accountId: currentMatchedAccountId,
      }),
      fetchQuickRelatedJobsByAccount({
        plugin,
        accountType: currentAccountType,
        accountId: currentMatchedAccountId,
      }),
    ])
      .then(([inquiries, jobs]) => {
        if (!cancelled) {
          setRelatedInquiries(Array.isArray(inquiries) ? inquiries : []);
          setRelatedJobs(Array.isArray(jobs) ? jobs : []);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          console.error("[QuickInquiry] Failed loading related records", loadError);
          setRelatedInquiries([]);
          setRelatedJobs([]);
          setRelatedError(loadError?.message || "Unable to load related records.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRelatedLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentAccountType,
    currentMatchedAccountId,
    open,
    plugin,
    setIsRelatedLoading,
    setRelatedError,
    setRelatedInquiries,
    setRelatedJobs,
  ]);

  return {
    currentAccountType,
    currentMatchedAccountId,
    isQuickPestServiceSelected,
    selectedQuickServiceInquiryLabel,
    serviceNameById,
  };
}
