import { useCallback, useEffect } from "react";
import { toText } from "@shared/utils/formatters.js";
import { isBodyCorpCompanyAccountType } from "@shared/utils/accountTypeUtils.js";
import {
  fetchCompanyAccountRecordById,
  fetchContactAccountRecordById,
  normalizePropertyLookupRecord,
  mergePropertyLookupRecords,
  searchCompaniesForLookup,
  searchContactsForLookup,
} from "@modules/details-workspace/exports/api.js";
import {
  fetchDetailedJobRecord,
  fetchInquiryAccountContextById,
  fetchPropertyRecordById,
  normalizeInquiryCompanyRecord,
} from "../api/jobDetailsDataApi.js";

export function useJobAccountDetails({
  effectiveJobId,
  isSdkReady,
  loadedAccountType,
  loadedClientEntityId,
  loadedClientIndividualId,
  loadedPropertyId,
  plugin,
  relatedInquiryId,
  setAccountContactRecord,
  setAccountCompanyRecord,
  setIsAccountDetailsLoading,
  setLinkedProperties,
  setLoadedPropertyId,
  setSelectedWorkspacePropertyId,
  setWorkspacePropertyLookupRecords,
  setCompanyLookupRecords,
  setContactLookupRecords,
  setIsCompanyLookupLoading,
  setIsContactLookupLoading,
}) {
  // Account details load effect
  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setAccountContactRecord(null);
      setAccountCompanyRecord(null);
      setIsAccountDetailsLoading(false);
      return;
    }
    const jobId = toText(effectiveJobId);
    if (!jobId) {
      setAccountContactRecord(null);
      setAccountCompanyRecord(null);
      setIsAccountDetailsLoading(false);
      return;
    }

    let cancelled = false;
    setIsAccountDetailsLoading(true);
    const loadAccountDetails = async () => {
      try {
        const detailedJob = await fetchDetailedJobRecord({
          plugin,
          field: "id",
          value: jobId,
        });
        if (cancelled) return;

        const jobContactRaw =
          detailedJob?.Client_Individual || detailedJob?.client_individual || null;
        const jobCompanyRaw =
          detailedJob?.Client_Entity || detailedJob?.client_entity || null;
        const jobPropertyRaw = detailedJob?.Property || detailedJob?.property || null;
        const jobContact = Array.isArray(jobContactRaw) ? jobContactRaw[0] || null : jobContactRaw;
        let jobCompany = Array.isArray(jobCompanyRaw) ? jobCompanyRaw[0] || null : jobCompanyRaw;
        let resolvedJobContact = jobContact || null;
        let resolvedJobProperty = Array.isArray(jobPropertyRaw)
          ? jobPropertyRaw[0] || null
          : jobPropertyRaw || null;
        const resolvedCompanyId = toText(
          detailedJob?.client_entity_id ||
            detailedJob?.Client_Entity_ID ||
            jobCompany?.id ||
            jobCompany?.ID ||
            loadedClientEntityId
        );
        const resolvedContactId = toText(
          detailedJob?.client_individual_id ||
            detailedJob?.Client_Individual_ID ||
            resolvedJobContact?.id ||
            resolvedJobContact?.ID ||
            loadedClientIndividualId
        );
        const resolvedPropertyId = toText(
          detailedJob?.property_id ||
            detailedJob?.Property_ID ||
            resolvedJobProperty?.id ||
            resolvedJobProperty?.ID ||
            resolvedJobProperty?.Property_ID ||
            loadedPropertyId
        );

        const companyAccountType = toText(
          jobCompany?.account_type || jobCompany?.Account_Type || loadedAccountType
        );
        const hasNestedPrimaryPerson = Boolean(
          toText(jobCompany?.Primary_Person?.id) ||
            toText(jobCompany?.Primary_Person?.email) ||
            toText(jobCompany?.primary_person?.id) ||
            toText(jobCompany?.primary_person?.email)
        );
        const needsCompanyRefresh = Boolean(
          resolvedCompanyId &&
            (!jobCompany ||
              !toText(jobCompany?.id || jobCompany?.ID) ||
              !hasNestedPrimaryPerson ||
              !toText(jobCompany?.account_type || jobCompany?.Account_Type) ||
              (isBodyCorpCompanyAccountType(companyAccountType) &&
                !toText(jobCompany?.Body_Corporate_Company?.name) &&
                !toText(jobCompany?.body_corporate_company?.name) &&
                !toText(jobCompany?.Body_Corporate_Company?.id) &&
                !toText(jobCompany?.body_corporate_company?.id)))
        );
        if (needsCompanyRefresh) {
          try {
            const fetchedCompany = await fetchCompanyAccountRecordById({
              plugin,
              companyId: resolvedCompanyId,
            });
            if (cancelled) return;
            if (fetchedCompany) {
              jobCompany = {
                ...(jobCompany && typeof jobCompany === "object" ? jobCompany : {}),
                ...fetchedCompany,
                Primary_Person:
                  fetchedCompany?.Primary_Person ||
                  jobCompany?.Primary_Person ||
                  jobCompany?.primary_person,
                Body_Corporate_Company:
                  fetchedCompany?.Body_Corporate_Company ||
                  jobCompany?.Body_Corporate_Company ||
                  jobCompany?.body_corporate_company,
              };
            }
          } catch (companyLoadError) {
            if (cancelled) return;
            console.warn("[JobDetailsBlank] Failed loading company account details", companyLoadError);
          }
        }

        const resolvedCompanyAccountType = toText(
          jobCompany?.account_type || jobCompany?.Account_Type || loadedAccountType
        );

        const needsContactRefresh = Boolean(
          resolvedContactId &&
            (!resolvedJobContact ||
              !toText(resolvedJobContact?.id || resolvedJobContact?.ID) ||
              (!toText(resolvedJobContact?.first_name) &&
                !toText(resolvedJobContact?.last_name) &&
                !toText(resolvedJobContact?.email)))
        );
        if (needsContactRefresh) {
          try {
            const fetchedContact = await fetchContactAccountRecordById({
              plugin,
              contactId: resolvedContactId,
            });
            if (cancelled) return;
            if (fetchedContact) {
              resolvedJobContact = {
                ...(resolvedJobContact && typeof resolvedJobContact === "object"
                  ? resolvedJobContact
                  : {}),
                ...fetchedContact,
              };
            }
          } catch (contactLoadError) {
            if (cancelled) return;
            console.warn("[JobDetailsBlank] Failed loading contact account details", contactLoadError);
          }
        }

        const needsBodyCorpFallback =
          isBodyCorpCompanyAccountType(resolvedCompanyAccountType) &&
          !toText(jobCompany?.Body_Corporate_Company?.name) &&
          !toText(jobCompany?.body_corporate_company?.name) &&
          !toText(jobCompany?.Body_Corporate_Company?.id) &&
          !toText(jobCompany?.body_corporate_company?.id) &&
          toText(relatedInquiryId);

        if (needsBodyCorpFallback) {
          try {
            const inquiryRecord = await fetchInquiryAccountContextById({
              plugin,
              inquiryId: relatedInquiryId,
            });
            if (cancelled) return;
            const inquiryCompany = normalizeInquiryCompanyRecord(inquiryRecord || {});
            const inquiryBodyCorp =
              inquiryCompany?.Body_Corporate_Company || inquiryCompany?.body_corporate_company;
            if (jobCompany && inquiryBodyCorp) {
              jobCompany = {
                ...jobCompany,
                Body_Corporate_Company: inquiryBodyCorp,
              };
            }
          } catch (inquiryLoadError) {
            if (cancelled) return;
            console.warn(
              "[JobDetailsBlank] Failed loading inquiry body corp context for account details",
              inquiryLoadError
            );
          }
        }

        if ((!resolvedJobProperty || !toText(resolvedJobProperty?.id || resolvedJobProperty?.ID)) && resolvedPropertyId) {
          try {
            resolvedJobProperty = await fetchPropertyRecordById({
              plugin,
              propertyId: resolvedPropertyId,
            });
          } catch (propertyLoadError) {
            if (cancelled) return;
            console.warn("[JobDetailsBlank] Failed loading property details", propertyLoadError);
          }
        }

        if (resolvedPropertyId) {
          const normalizedProperty = normalizePropertyLookupRecord(
            resolvedJobProperty || { id: resolvedPropertyId }
          );
          setLoadedPropertyId((previous) => toText(previous || normalizedProperty.id));
          setSelectedWorkspacePropertyId((previous) => toText(previous || normalizedProperty.id));
          setWorkspacePropertyLookupRecords((previous) =>
            mergePropertyLookupRecords(previous, [normalizedProperty])
          );
          setLinkedProperties((previous) =>
            mergePropertyLookupRecords(previous, [normalizedProperty])
          );
        }

        setAccountContactRecord(resolvedJobContact || null);
        setAccountCompanyRecord(jobCompany || null);
      } catch (loadError) {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed loading account details", loadError);
        setAccountContactRecord(null);
        setAccountCompanyRecord(null);
      } finally {
        if (cancelled) return;
        setIsAccountDetailsLoading(false);
      }
    };

    loadAccountDetails();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveJobId,
    isSdkReady,
    loadedAccountType,
    loadedClientEntityId,
    loadedClientIndividualId,
    loadedPropertyId,
    plugin,
    relatedInquiryId,
  ]);

  const searchCompaniesInDatabase = useCallback(
    async (query = "") => {
      if (!isSdkReady || !plugin) {
        setCompanyLookupRecords([]);
        setIsCompanyLookupLoading(false);
        return [];
      }
      setIsCompanyLookupLoading(true);
      try {
        const records = await searchCompaniesForLookup({
          plugin,
          query: toText(query),
          limit: 25,
        });
        const normalized = Array.isArray(records) ? records : [];
        setCompanyLookupRecords(normalized);
        return normalized;
      } catch (lookupError) {
        console.error("[JobDetailsBlank] Company lookup search failed", lookupError);
        setCompanyLookupRecords([]);
        return [];
      } finally {
        setIsCompanyLookupLoading(false);
      }
    },
    [isSdkReady, plugin]
  );

  const searchContactsInDatabase = useCallback(
    async (query = "") => {
      if (!isSdkReady || !plugin) {
        setContactLookupRecords([]);
        setIsContactLookupLoading(false);
        return [];
      }
      setIsContactLookupLoading(true);
      try {
        const records = await searchContactsForLookup({
          plugin,
          query: toText(query),
          limit: 50,
        });
        const normalized = Array.isArray(records) ? records : [];
        setContactLookupRecords(normalized);
        return normalized;
      } catch (lookupError) {
        console.error("[JobDetailsBlank] Contact lookup search failed", lookupError);
        setContactLookupRecords([]);
        return [];
      } finally {
        setIsContactLookupLoading(false);
      }
    },
    [isSdkReady, plugin]
  );

  // Initial lookup preload
  useEffect(() => {
    if (!isSdkReady || !plugin) return;
    void searchCompaniesInDatabase("");
    void searchContactsInDatabase("");
  }, [isSdkReady, plugin, searchCompaniesInDatabase, searchContactsInDatabase]);

  return {
    searchCompaniesInDatabase,
    searchContactsInDatabase,
  };
}
