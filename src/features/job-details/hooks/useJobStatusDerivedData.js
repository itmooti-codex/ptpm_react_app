import { useMemo, useCallback } from "react";
import logoUrl from "../../../assets/logo.webp";
import {
  resolveJobStatusStyle,
} from "../../../shared/constants/statusStyles.js";
import {
  toText,
  formatActivityServiceLabel,
  formatCompanyLookupLabel,
  formatContactLookupLabel,
} from "@shared/utils/formatters.js";
import {
  isCompanyAccountType,
} from "@shared/utils/accountTypeUtils.js";
import {
  escapeHtml,
  formatCurrencyDisplay,
  formatDateDisplay,
  toAffiliationOption,
} from "../shared/jobDetailsFormatting.js";
import {
  getRelatedDealRecordKey,
  getRelatedJobRecordKey,
  mergeRelatedRecordCollections,
} from "../shared/jobDetailsRelatedRecords.js";

export function useJobStatusDerivedData({
  accountCompanyAddress,
  accountCompanyName,
  accountCompanyPrimaryName,
  accountCompanyPrimaryPhone,
  accountContactAddress,
  accountContactName,
  accountContactPhone,
  accountType,
  activePropertyAddress,
  activeWorkspaceProperty,
  affiliations,
  allocatedServiceProviderId,
  companyLookupRecords,
  contactLookupRecords,
  effectiveJobId,
  isCompanyAccount,
  isNewJob,
  isQuoteCompanyAccount,
  jobActivities,
  jobMaterials,
  jobTakenByPrefillLabel,
  jobTakenBySearch,
  loadedAccountType,
  loadedClientEntityId,
  loadedClientIndividualId,
  loadedJobStatus,
  loadedPropertyId,
  quotePaymentDetails,
  relatedInquiryId,
  relatedInquiryRecord,
  relatedInquiryUid,
  relatedRecords,
  routeJobStatus,
  safeUid,
  selectedAccountsContactId,
  selectedJobEmailContactId,
  selectedServiceProviderId,
  selectedWorkspacePropertyId,
  serviceProviderItems,
  serviceProviderSearch,
  workspacePropertyLookupRecords,
  workspacePropertySearchValue,
  accountCompanyRecord,
  accountContactRecord,
}) {
  const jobStatusLabel = loadedJobStatus || routeJobStatus || (isNewJob ? "New" : "Quote Created");
  const jobStatusStyle = useMemo(
    () => resolveJobStatusStyle(jobStatusLabel),
    [jobStatusLabel]
  );

  const hasRelatedInquiry = Boolean(toText(relatedInquiryUid));
  const relatedInquiryDetailsPath = useMemo(() => {
    if (!hasRelatedInquiry) return "";
    return `/inquiry-details/${encodeURIComponent(toText(relatedInquiryUid))}`;
  }, [hasRelatedInquiry, relatedInquiryUid]);

  const appointmentPrefillContext = useMemo(() => {
    const hostId = toText(selectedServiceProviderId || allocatedServiceProviderId);
    const selectedHost = serviceProviderItems.find((item) => toText(item?.id) === hostId);
    const hostLabel = toText(selectedHost?.label || serviceProviderSearch || hostId);
    const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
    const propertyLabel = toText(
      activeWorkspaceProperty?.property_name || activeWorkspaceProperty?.Property_Name || workspacePropertySearchValue || activePropertyAddress
    );
    const accountLabel = isCompanyAccount
      ? toText(accountCompanyName || accountCompanyPrimaryName)
      : toText(accountContactName);
    return {
      accountType: isCompanyAccount ? "Company" : "Contact",
      locationId: propertyId,
      locationLabel: propertyLabel,
      hostId,
      hostLabel,
      guestId: isCompanyAccount ? toText(loadedClientEntityId) : toText(loadedClientIndividualId),
      guestLabel: accountLabel,
      title: [safeUid, accountLabel, propertyLabel].filter(Boolean).join(" | "),
      description: [propertyLabel, activePropertyAddress].filter(Boolean).join("\n"),
    };
  }, [
    accountCompanyName, accountCompanyPrimaryName, accountContactName, activePropertyAddress,
    activeWorkspaceProperty?.Property_Name, activeWorkspaceProperty?.property_name,
    allocatedServiceProviderId, isCompanyAccount, loadedClientEntityId, loadedClientIndividualId,
    loadedPropertyId, safeUid, selectedServiceProviderId, selectedWorkspacePropertyId,
    serviceProviderItems, serviceProviderSearch, workspacePropertySearchValue,
  ]);

  const reviewJobSheetHtml = useMemo(() => {
    const accountLabel = isCompanyAccount ? accountCompanyName || accountCompanyPrimaryName : accountContactName;
    const accountAddressLabel = isCompanyAccount ? accountCompanyAddress : accountContactAddress;
    const residentsRows = [
      [accountContactName, accountContactPhone].filter(Boolean).join("  Ph: "),
      [accountCompanyPrimaryName, accountCompanyPrimaryPhone].filter(Boolean).join("  Ph: "),
    ].filter(Boolean);
    const activitiesRows = (Array.isArray(jobActivities) ? jobActivities : [])
      .filter((item) => {
        const val = item?.include_in_quote ?? item?.Include_in_Quote ?? item?.Include_In_Quote;
        return val === true || String(val || "").toLowerCase() === "true";
      })
      .map((item, index) => ({
        key: toText(item?.id || item?.ID || index + 1),
        task: toText(item?.task || item?.Task),
        option: toText(item?.option || item?.Option),
        service: formatActivityServiceLabel(item) || toText(item?.activity_text),
        qty: toText(item?.quantity || item?.Quantity || "1"),
        price: formatCurrencyDisplay(item?.activity_price || item?.Activity_Price || 0),
      }))
      .filter((row) => row.task || row.option || row.service);

    const recommendationText = toText(
      quotePaymentDetails?.admin_recommendation || relatedInquiryRecord?.recommendations
    );
    const feedbackSection = recommendationText
      ? `
      <div class="js-section-title js-section-title-center">Resident's Feedback</div>
      <div class="js-recommendation"><b>Recommendations:</b> ${escapeHtml(recommendationText)}</div>
      `
      : "";

    const logoAbsUrl = `${window.location.origin}${logoUrl}`;
    return `<style>
  .js-sheet { font-family: Arial, sans-serif; color: #111; font-size: 12px; border: 1px solid #cbd5e1; padding: 10px; }
  .js-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .js-logo { max-height: 56px; max-width: 180px; object-fit: contain; }
  .js-top { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
  .js-title { text-align: center; font-weight: 700; font-size: 30px; letter-spacing: .5px; margin: 4px 0 10px; }
  .js-muted { color: #334155; }
  .js-section-title { font-weight: 700; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 3px 0; margin: 8px 0 6px; }
  .js-section-title-center { text-align: center; }
  .js-grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; }
  .js-recommendation { margin-top: 6px; }
  .js-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .js-table th, .js-table td { border: 1px solid #94a3b8; padding: 4px; text-align: left; font-size: 11px; }
  .js-table th { background: #f1f5f9; }
</style>
<div class="js-sheet">
  <div class="js-header">
    <img src="${logoAbsUrl}" class="js-logo" alt="Logo" />
  </div>
  <div class="js-top">
    <div>
      <div><b>Account Name:</b> ${escapeHtml(toText(accountLabel))}</div>
      <div><b>Account Type:</b> ${escapeHtml(toText(accountType || "-"))}</div>
      <div><b>Work Req. By:</b> ${escapeHtml(toText(jobTakenBySearch || jobTakenByPrefillLabel))}</div>
      <div><b>Work Order #:</b> ${escapeHtml(toText(safeUid))}</div>
      <div><b>Job Address:</b> ${escapeHtml(toText(activePropertyAddress || accountAddressLabel))}</div>
      <div><b>Job Suburb:</b> ${escapeHtml(toText(activeWorkspaceProperty?.suburb_town || activeWorkspaceProperty?.Suburb_Town || activeWorkspaceProperty?.city || activeWorkspaceProperty?.City))}</div>
    </div>
    <div class="js-muted"><b>Date:</b> ${escapeHtml(formatDateDisplay(Date.now()))}</div>
  </div>
  <div class="js-title">JOB SHEET</div>
  <div class="js-section-title">Resident's Details</div>
  ${residentsRows.length ? residentsRows.map((row) => `<div>${escapeHtml(row)}</div>`).join("") : "<div>-</div>"}
  ${feedbackSection}
  <div class="js-section-title">Activities</div>
  ${
    activitiesRows.length
      ? `<table class="js-table"><thead><tr><th>Task</th><th>Option</th><th>Service</th><th>Qty</th><th>Price</th></tr></thead><tbody>${
          activitiesRows
            .map(
              (row) =>
                `<tr><td>${escapeHtml(row.task)}</td><td>${escapeHtml(row.option)}</td><td>${escapeHtml(
                  row.service
                )}</td><td>${escapeHtml(row.qty)}</td><td>${escapeHtml(row.price)}</td></tr>`
            )
            .join("")
        }</tbody></table>`
      : "<div>No activities found.</div>"
  }
</div>`;
  }, [
    accountCompanyAddress, accountCompanyName, accountCompanyPrimaryName,
    accountContactAddress, accountContactName, accountContactPhone,
    accountType, activePropertyAddress, activeWorkspaceProperty,
    isCompanyAccount, jobActivities, jobTakenByPrefillLabel, jobTakenBySearch,
    quotePaymentDetails?.admin_recommendation, relatedInquiryRecord, safeUid,
  ]);

  const quoteHeaderData = useMemo(() => {
    const accountLabel = isCompanyAccount ? accountCompanyName || accountCompanyPrimaryName : accountContactName;
    const accountAddressLabel = isCompanyAccount ? accountCompanyAddress : accountContactAddress;
    return {
      logoUrl: `${window.location.origin}${logoUrl}`,
      accountName: toText(accountLabel),
      accountType: toText(accountType || "\u2014"),
      workReqBy: toText(jobTakenBySearch || jobTakenByPrefillLabel),
      workOrderUid: toText(safeUid),
      jobAddress: toText(activePropertyAddress || accountAddressLabel),
      jobSuburb: toText(
        activeWorkspaceProperty?.suburb_town || activeWorkspaceProperty?.Suburb_Town ||
        activeWorkspaceProperty?.city || activeWorkspaceProperty?.City
      ),
      date: formatDateDisplay(Date.now()),
      residentsRows: [
        [accountContactName, accountContactPhone].filter(Boolean).join("  Ph: "),
        [accountCompanyPrimaryName, accountCompanyPrimaryPhone].filter(Boolean).join("  Ph: "),
      ].filter(Boolean),
      feedback: null,
      recommendation: toText(
        quotePaymentDetails?.admin_recommendation || relatedInquiryRecord?.recommendations
      ),
    };
  }, [
    accountCompanyAddress, accountCompanyName, accountCompanyPrimaryName, accountCompanyPrimaryPhone,
    accountContactAddress, accountContactName, accountContactPhone, accountType,
    activePropertyAddress, activeWorkspaceProperty, isCompanyAccount, jobTakenByPrefillLabel,
    jobTakenBySearch, quotePaymentDetails?.admin_recommendation, relatedInquiryRecord, safeUid,
  ]);

  // Lookup items
  const companyItems = useMemo(
    () =>
      (Array.isArray(companyLookupRecords) ? companyLookupRecords : [])
        .map((company) => {
          const id = toText(company?.id || company?.ID || company?.Company_ID);
          if (!id) return null;
          const pp = company?.Primary_Person || company?.primary_person || {};
          const ppName = [toText(pp?.first_name || pp?.First_Name), toText(pp?.last_name || pp?.Last_Name)].filter(Boolean).join(" ");
          const ppEmail = toText(pp?.email || pp?.Email);
          const ppPhone = toText(pp?.sms_number || pp?.SMS_Number || pp?.office_phone || pp?.Office_Phone);
          const companyPhone = toText(company?.phone || company?.Phone);
          const companyAddress = toText(company?.address || company?.Address);
          const meta = [ppName, ppEmail, ppPhone, companyPhone, companyAddress].filter(Boolean).join(" · ") || undefined;
          return { id, label: formatCompanyLookupLabel(company), meta };
        })
        .filter(Boolean),
    [companyLookupRecords]
  );

  const contactItems = useMemo(
    () =>
      (Array.isArray(contactLookupRecords) ? contactLookupRecords : [])
        .map((contact) => {
          const id = toText(contact?.id || contact?.ID || contact?.Contact_ID);
          if (!id) return null;
          return { id, label: formatContactLookupLabel(contact) };
        })
        .filter(Boolean),
    [contactLookupRecords]
  );

  const jobEmailFallbackLabel = useMemo(() => {
    const selectedId = toText(selectedJobEmailContactId);
    if (!selectedId) return "";
    if (isQuoteCompanyAccount) {
      return formatCompanyLookupLabel({
        id: selectedId,
        name: toText(accountCompanyRecord?.name || accountCompanyRecord?.Name),
        phone: toText(accountCompanyRecord?.phone || accountCompanyRecord?.Phone),
        account_type: toText(
          accountCompanyRecord?.account_type || accountCompanyRecord?.Account_Type || loadedAccountType
        ),
      });
    }
    return formatContactLookupLabel({
      id: selectedId,
      first_name: toText(accountContactRecord?.first_name || accountContactRecord?.First_Name),
      last_name: toText(accountContactRecord?.last_name || accountContactRecord?.Last_Name),
      email: toText(accountContactRecord?.email || accountContactRecord?.Email),
      sms_number: toText(accountContactRecord?.sms_number || accountContactRecord?.SMS_Number),
    });
  }, [accountCompanyRecord, accountContactRecord, isQuoteCompanyAccount, loadedAccountType, selectedJobEmailContactId]);

  const jobEmailItems = useMemo(() => {
    const baseItems = isQuoteCompanyAccount ? companyItems : contactItems;
    const selectedId = toText(selectedJobEmailContactId);
    if (!selectedId) return baseItems;
    if (baseItems.some((item) => toText(item?.id) === selectedId)) return baseItems;
    return [{ id: selectedId, label: jobEmailFallbackLabel || selectedId }, ...baseItems];
  }, [companyItems, contactItems, isQuoteCompanyAccount, jobEmailFallbackLabel, selectedJobEmailContactId]);

  const affiliationItems = useMemo(
    () =>
      (Array.isArray(affiliations) ? affiliations : [])
        .map((affiliation) => toAffiliationOption(affiliation))
        .filter((item) => Boolean(toText(item?.id))),
    [affiliations]
  );

  const accountsContactItems = useMemo(() => {
    const selectedId = toText(selectedAccountsContactId);
    if (!selectedId) return affiliationItems;
    if (affiliationItems.some((item) => toText(item?.id) === selectedId)) return affiliationItems;
    return [{ id: selectedId, label: selectedId }, ...affiliationItems];
  }, [affiliationItems, selectedAccountsContactId]);

  const relatedRecordsAccountType =
    isQuoteCompanyAccount || (toText(loadedClientEntityId) && !toText(loadedClientIndividualId))
      ? "Company"
      : "Contact";
  const relatedRecordsAccountId =
    relatedRecordsAccountType === "Company"
      ? toText(loadedClientEntityId || loadedClientIndividualId)
      : toText(loadedClientIndividualId || loadedClientEntityId);

  const contextualRelatedDeal = useMemo(() => {
    const resolvedId = toText(relatedInquiryRecord?.id || relatedInquiryRecord?.ID || relatedInquiryId);
    const resolvedUid = toText(relatedInquiryRecord?.unique_id || relatedInquiryRecord?.Unique_ID || relatedInquiryUid);
    const resolvedDealName = toText(relatedInquiryRecord?.deal_name || relatedInquiryRecord?.Deal_Name);
    if (!resolvedId && !resolvedUid) return null;
    return {
      ...(relatedInquiryRecord && typeof relatedInquiryRecord === "object" ? relatedInquiryRecord : {}),
      id: resolvedId, unique_id: resolvedUid, deal_name: resolvedDealName,
    };
  }, [relatedInquiryId, relatedInquiryRecord, relatedInquiryUid]);

  const contextualCurrentJob = useMemo(() => {
    const resolvedJobId = toText(effectiveJobId);
    const resolvedJobUid = toText(safeUid);
    const propertyName = toText(
      activeWorkspaceProperty?.property_name || activeWorkspaceProperty?.Property_Name ||
      activeWorkspaceProperty?.address_1 || activeWorkspaceProperty?.Address_1 ||
      activeWorkspaceProperty?.address || activeWorkspaceProperty?.Address
    );
    if (!resolvedJobId && !resolvedJobUid) return null;
    return {
      id: resolvedJobId, unique_id: resolvedJobUid, job_status: toText(loadedJobStatus),
      quote_status: toText(quotePaymentDetails?.quote_status), property_name: propertyName,
    };
  }, [activeWorkspaceProperty, effectiveJobId, loadedJobStatus, quotePaymentDetails?.quote_status, safeUid]);

  const relatedDealsForDisplay = useMemo(
    () => mergeRelatedRecordCollections(relatedRecords?.relatedDeals, contextualRelatedDeal ? [contextualRelatedDeal] : [], getRelatedDealRecordKey),
    [contextualRelatedDeal, relatedRecords?.relatedDeals]
  );
  const relatedJobsForDisplay = useMemo(
    () => mergeRelatedRecordCollections(relatedRecords?.relatedJobs, contextualCurrentJob ? [contextualCurrentJob] : [], getRelatedJobRecordKey),
    [contextualCurrentJob, relatedRecords?.relatedJobs]
  );

  const workspaceLookupData = useMemo(
    () => ({
      contacts: Array.isArray(contactLookupRecords) ? contactLookupRecords : [],
      companies: Array.isArray(companyLookupRecords) ? companyLookupRecords : [],
      properties: Array.isArray(workspacePropertyLookupRecords) ? workspacePropertyLookupRecords : [],
      serviceProviders: Array.isArray(serviceProviderItems) ? serviceProviderItems : [],
    }),
    [companyLookupRecords, contactLookupRecords, serviceProviderItems, workspacePropertyLookupRecords]
  );

  const jobDirectBootstrapJobData = useMemo(() => {
    const selectedAccountsContactIdText = toText(selectedAccountsContactId);
    const selectedAffiliation = selectedAccountsContactIdText
      ? (Array.isArray(affiliations) ? affiliations : []).find(
          (a) => toText(a?.id) === selectedAccountsContactIdText
        )
      : null;
    const clientContactFirstName = toText(accountContactRecord?.first_name || accountContactRecord?.First_Name);
    const clientContactLastName = toText(accountContactRecord?.last_name || accountContactRecord?.Last_Name);
    const clientContactEmail = toText(accountContactRecord?.email || accountContactRecord?.Email);
    const clientCompanyName = toText(accountCompanyRecord?.name || accountCompanyRecord?.Name);
    const clientCompanyEmail = toText(
      accountCompanyRecord?.Primary_Person?.email || accountCompanyRecord?.Primary_Person?.Email ||
      accountCompanyRecord?.primary_person?.email || accountCompanyRecord?.primary_person?.Email
    );
    const acFirstName = toText(selectedAffiliation?.contact_first_name) ||
      (isCompanyAccountType(toText(loadedAccountType).toLowerCase()) ? clientCompanyName : clientContactFirstName);
    const acLastName = toText(selectedAffiliation?.contact_last_name) ||
      (isCompanyAccountType(toText(loadedAccountType).toLowerCase()) ? "" : clientContactLastName);
    const acEmail = toText(selectedAffiliation?.contact_email || selectedAffiliation?.company_as_accounts_contact_email) ||
      (isCompanyAccountType(toText(loadedAccountType).toLowerCase()) ? clientCompanyEmail : clientContactEmail);
    const contactXeroId = toText(accountContactRecord?.xero_contact_id || accountContactRecord?.Xero_Contact_ID);
    const companyXeroId = toText(accountCompanyRecord?.xero_contact_id || accountCompanyRecord?.Xero_Contact_ID);
    return {
      id: toText(effectiveJobId), ID: toText(effectiveJobId),
      unique_id: safeUid, Unique_ID: safeUid,
      inquiry_record_id: toText(relatedInquiryId), Inquiry_Record_ID: toText(relatedInquiryId),
      account_type: toText(loadedAccountType), Account_Type: toText(loadedAccountType),
      client_entity_id: toText(loadedClientEntityId), Client_Entity_ID: toText(loadedClientEntityId),
      client_individual_id: toText(loadedClientIndividualId), Client_Individual_ID: toText(loadedClientIndividualId),
      property_id: toText(selectedWorkspacePropertyId || loadedPropertyId),
      Property_ID: toText(selectedWorkspacePropertyId || loadedPropertyId),
      activities: Array.isArray(jobActivities) ? jobActivities : [],
      materials: Array.isArray(jobMaterials) ? jobMaterials : [],
      accounts_contact_contact_first_name: acFirstName, Accounts_Contact_Contact_First_Name: acFirstName,
      accounts_contact_contact_last_name: acLastName, Accounts_Contact_Contact_Last_Name: acLastName,
      accounts_contact_contact_email: acEmail, Accounts_Contact_Contact_Email: acEmail,
      Client_Individual_Xero_Contact_ID: contactXeroId, client_individual_xero_contact_id: contactXeroId,
      Client_Entity_Xero_Contact_ID: companyXeroId, client_entity_xero_contact_id: companyXeroId,
    };
  }, [
    accountCompanyRecord, accountContactRecord, affiliations, effectiveJobId,
    jobActivities, jobMaterials, loadedAccountType, loadedClientEntityId,
    loadedClientIndividualId, loadedPropertyId, relatedInquiryId, safeUid,
    selectedAccountsContactId, selectedWorkspacePropertyId,
  ]);

  return {
    accountsContactItems, affiliationItems, appointmentPrefillContext, companyItems, contactItems,
    contextualCurrentJob, contextualRelatedDeal, hasRelatedInquiry, jobDirectBootstrapJobData,
    jobEmailFallbackLabel, jobEmailItems, jobStatusLabel, jobStatusStyle, quoteHeaderData,
    relatedDealsForDisplay, relatedInquiryDetailsPath, relatedJobsForDisplay,
    relatedRecordsAccountId, relatedRecordsAccountType, reviewJobSheetHtml,
    workspaceLookupData,
  };
}
