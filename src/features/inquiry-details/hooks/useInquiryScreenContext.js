import { useCallback, useMemo } from "react";
import { APP_USER } from "../../../config/userConfig.js";
import { resolveStatusStyle } from "../../../shared/constants/statusStyles.js";
import { useCurrentUserProfile } from "../../../shared/hooks/useCurrentUserProfile.js";
import {
  fullName,
  toText,
} from "@shared/utils/formatters.js";
import {
  isBodyCorpCompanyAccountType,
  isCompanyAccountType,
  isContactAccountType,
} from "@shared/utils/accountTypeUtils.js";
import {
  getInquiryCompany,
  getInquiryPrimaryContact,
  normalizeRelationRecord,
  normalizeServiceProviderContact,
} from "../shared/inquiryDetailsRecordHelpers.js";

export function useInquiryScreenContext({
  isContextLoading,
  isQuickInquiryBookingMode,
  linkedJobSelectionOverride,
  location,
  resolvedInquiry,
  safeUid,
  serviceProviderFallback,
}) {
  const inquiry = resolvedInquiry || {};
  const inquiryStatus = useMemo(
    () =>
      String(
        resolvedInquiry?.inquiry_status ||
          resolvedInquiry?.Inquiry_Status ||
          (isQuickInquiryBookingMode ? "New Inquiry" : "")
      ).trim(),
    [isQuickInquiryBookingMode, resolvedInquiry]
  );
  const inquiryNumericId = useMemo(
    () => String(resolvedInquiry?.id || resolvedInquiry?.ID || "").trim(),
    [resolvedInquiry]
  );
  const inquiryStatusStyle = useMemo(() => {
    if (!inquiryStatus) {
      return { color: "#64748b", backgroundColor: "#f1f5f9" };
    }
    return resolveStatusStyle(inquiryStatus);
  }, [inquiryStatus]);
  const headerInquiryStatusLabel = isQuickInquiryBookingMode
    ? "New Inquiry"
    : inquiryStatus || (isContextLoading ? "Loading..." : "Unknown");
  const headerInquiryStatusStyle = isQuickInquiryBookingMode
    ? resolveStatusStyle("New Inquiry")
    : inquiryStatusStyle;
  const externalInquiryUrl = useMemo(() => {
    if (!inquiryNumericId) return "";
    return `https://app.ontraport.com/#!/deal/edit&id=${encodeURIComponent(inquiryNumericId)}`;
  }, [inquiryNumericId]);
  const currentActivityPath = useMemo(
    () => `${toText(location?.pathname) || "/"}${toText(location?.search)}`,
    [location?.pathname, location?.search]
  );

  const inquiryPrimaryContact = getInquiryPrimaryContact(inquiry);
  const inquiryCompany = getInquiryCompany(inquiry);
  const inquiryCompanyPrimaryPerson =
    inquiryCompany?.Primary_Person || inquiryCompany?.primary_person || {};
  const inquiryBodyCorpCompanyRaw =
    inquiryCompany?.Body_Corporate_Company || inquiryCompany?.body_corporate_company || null;
  const inquiryBodyCorpCompany = Array.isArray(inquiryBodyCorpCompanyRaw)
    ? inquiryBodyCorpCompanyRaw[0] || {}
    : inquiryBodyCorpCompanyRaw || {};
  const serviceProvider = normalizeRelationRecord(
    inquiry?.Service_Provider || inquiry?.service_provider
  );
  const serviceProviderContact = normalizeServiceProviderContact(serviceProvider);
  const serviceProviderFallbackRecord = normalizeRelationRecord(serviceProviderFallback);
  const serviceProviderFallbackContact = normalizeServiceProviderContact(serviceProviderFallbackRecord);

  const inquiryAccountType = toText(inquiry?.account_type || inquiry?.Account_Type);
  const normalizedAccountType = inquiryAccountType.toLowerCase();
  const isContactAccount = isContactAccountType(normalizedAccountType);
  const isCompanyAccount = isCompanyAccountType(normalizedAccountType);
  const hasInquiryContactDetails = Boolean(
    fullName(inquiryPrimaryContact?.first_name, inquiryPrimaryContact?.last_name) ||
      toText(inquiryPrimaryContact?.email) ||
      toText(inquiryPrimaryContact?.sms_number) ||
      toText(inquiryPrimaryContact?.address)
  );
  const hasInquiryCompanyDetails = Boolean(
    toText(inquiryCompany?.name) || toText(inquiryCompany?.phone) || toText(inquiryCompany?.address)
  );
  const companyAccountType = toText(
    inquiryCompany?.account_type || inquiryCompany?.Account_Type || inquiry?.Company_Account_Type
  );
  const isBodyCorpAccount = isBodyCorpCompanyAccountType(companyAccountType);
  const showContactDetails = isContactAccount || (!isCompanyAccount && hasInquiryContactDetails);
  const showCompanyDetails = isCompanyAccount || (!isContactAccount && hasInquiryCompanyDetails);

  const accountType = inquiryAccountType;
  const quoteJobIdFromRecord = toText(
    inquiry?.quote_record_id || inquiry?.Quote_Record_ID || inquiry?.Quote_record_ID
  );
  const linkedInquiryJobIdFromRecord = toText(
    inquiry?.inquiry_for_job_id || inquiry?.Inquiry_For_Job_ID || inquiry?.Inquiry_for_Job_ID
  );
  const inquiryCompanyId = toText(
    inquiry?.company_id || inquiry?.Company_ID || inquiryCompany?.id || inquiryCompany?.ID
  );
  const inquiryContactId = toText(
    inquiry?.primary_contact_id ||
      inquiry?.Primary_Contact_ID ||
      inquiryPrimaryContact?.id ||
      inquiryPrimaryContact?.ID
  );
  const contactPopupComment = toText(
    inquiryPrimaryContact?.popup_comment || inquiryPrimaryContact?.Popup_Comment
  );
  const companyPopupComment = toText(inquiryCompany?.popup_comment || inquiryCompany?.Popup_Comment);
  const hasPopupCommentsSection = Boolean(showContactDetails || showCompanyDetails);
  const hasAnyPopupComment = Boolean(contactPopupComment || companyPopupComment);
  const hasMemoContext = Boolean(inquiryNumericId);

  const { profile: currentUserProfile } = useCurrentUserProfile();
  const currentUserId = toText(currentUserProfile?.id || APP_USER?.id);
  const currentAdminContactId = toText(APP_USER?.id);
  const currentUserMemoAuthor = useMemo(
    () => ({
      id: currentUserId,
      display_name: toText(currentUserProfile?.displayName),
      first_name: toText(currentUserProfile?.firstName),
      last_name: toText(currentUserProfile?.lastName),
      profile_image: toText(currentUserProfile?.profileImage),
      email: toText(currentUserProfile?.email),
      sms_number: toText(currentUserProfile?.smsNumber),
    }),
    [
      currentUserId,
      currentUserProfile?.displayName,
      currentUserProfile?.email,
      currentUserProfile?.firstName,
      currentUserProfile?.lastName,
      currentUserProfile?.profileImage,
      currentUserProfile?.smsNumber,
    ]
  );
  const resolveMemoAuthor = useCallback(
    (author = {}, authorId = "") => {
      if (!currentUserId || toText(authorId) !== currentUserId) {
        return author || {};
      }

      return {
        ...currentUserMemoAuthor,
        ...(author && typeof author === "object" ? author : {}),
        id: toText(author?.id) || currentUserMemoAuthor.id,
        display_name:
          toText(author?.display_name || author?.Display_Name) || currentUserMemoAuthor.display_name,
        first_name: toText(author?.first_name || author?.First_Name) || currentUserMemoAuthor.first_name,
        last_name: toText(author?.last_name || author?.Last_Name) || currentUserMemoAuthor.last_name,
        profile_image:
          toText(author?.profile_image || author?.Profile_Image) || currentUserMemoAuthor.profile_image,
        email: toText(author?.email || author?.Email) || currentUserMemoAuthor.email,
        sms_number:
          toText(author?.sms_number || author?.SMS_Number) || currentUserMemoAuthor.sms_number,
      };
    },
    [currentUserId, currentUserMemoAuthor]
  );

  const relatedRecordsAccountType = useMemo(() => {
    if (isCompanyAccount) return "Company";
    if (isContactAccount) return "Contact";
    return inquiryCompanyId ? "Company" : "Contact";
  }, [inquiryCompanyId, isCompanyAccount, isContactAccount]);
  const relatedRecordsAccountId = useMemo(() => {
    if (relatedRecordsAccountType === "Company") {
      return inquiryCompanyId || inquiryContactId;
    }
    return inquiryContactId || inquiryCompanyId;
  }, [inquiryCompanyId, inquiryContactId, relatedRecordsAccountType]);
  const contactLogsContactId = useMemo(() => {
    if (relatedRecordsAccountType === "Company") {
      return toText(
        inquiryCompanyPrimaryPerson?.id ||
          inquiryCompanyPrimaryPerson?.ID ||
          inquiryPrimaryContact?.id ||
          inquiryPrimaryContact?.ID ||
          inquiryContactId
      );
    }
    return toText(
      inquiryPrimaryContact?.id ||
        inquiryPrimaryContact?.ID ||
        inquiryContactId ||
        inquiryCompanyPrimaryPerson?.id ||
        inquiryCompanyPrimaryPerson?.ID
    );
  }, [
    inquiryCompanyPrimaryPerson?.ID,
    inquiryCompanyPrimaryPerson?.id,
    inquiryContactId,
    inquiryPrimaryContact?.ID,
    inquiryPrimaryContact?.id,
    relatedRecordsAccountType,
  ]);
  const selectedRelatedJobId =
    linkedJobSelectionOverride !== undefined
      ? toText(linkedJobSelectionOverride)
      : linkedInquiryJobIdFromRecord || quoteJobIdFromRecord;

  return {
    accountType,
    companyAccountType,
    contactLogsContactId,
    contactPopupComment,
    currentActivityPath,
    currentAdminContactId,
    currentUserId,
    currentUserMemoAuthor,
    externalInquiryUrl,
    hasLinkedQuoteJob: Boolean(quoteJobIdFromRecord),
    hasAnyPopupComment,
    hasInquiryCompanyDetails,
    hasInquiryContactDetails,
    hasMemoContext,
    hasPopupCommentsSection,
    headerInquiryStatusLabel,
    headerInquiryStatusStyle,
    inquiry,
    inquiryAccountType,
    inquiryBodyCorpCompany,
    inquiryCompany,
    inquiryCompanyId,
    inquiryCompanyPrimaryPerson,
    inquiryContactId,
    linkedInquiryJobIdFromRecord,
    inquiryNumericId,
    inquiryPrimaryContact,
    inquiryStatus,
    inquiryStatusStyle,
    isBodyCorpAccount,
    isCompanyAccount,
    isContactAccount,
    normalizedAccountType,
    quoteJobIdFromRecord,
    relatedRecordsAccountId,
    relatedRecordsAccountType,
    resolveMemoAuthor,
    selectedRelatedJobId,
    serviceProvider,
    serviceProviderContact,
    serviceProviderFallbackContact,
    serviceProviderFallbackRecord,
    showCompanyDetails,
    showContactDetails,
    companyPopupComment,
  };
}
