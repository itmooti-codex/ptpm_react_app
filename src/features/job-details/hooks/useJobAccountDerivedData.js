import { useMemo, useCallback } from "react";
import {
  toText,
  fullName,
  joinAddress,
  toMailHref,
  toTelHref,
  toGoogleMapsHref,
} from "@shared/utils/formatters.js";
import {
  isContactAccountType,
  isCompanyAccountType,
  isBodyCorpCompanyAccountType,
  isLikelyEmailValue,
  isLikelyPhoneValue,
} from "@shared/utils/accountTypeUtils.js";
import { useCurrentUserProfile } from "@shared/hooks/useCurrentUserProfile.js";
import { APP_USER } from "../../../config/userConfig.js";

export function useJobAccountDerivedData({
  accountCompanyRecord,
  accountContactRecord,
  activeWorkspaceProperty,
  effectiveJobId,
  loadedAccountType,
  loadedClientEntityId,
  loadedClientIndividualId,
  loadedPropertyId,
  selectedWorkspacePropertyId,
}) {
  const accountPrimaryContact = accountContactRecord || {};
  const accountCompany = accountCompanyRecord || {};
  const accountCompanyPrimaryRaw =
    accountCompany?.Primary_Person || accountCompany?.primary_person || {};
  const accountCompanyPrimaryNested = Array.isArray(accountCompanyPrimaryRaw)
    ? accountCompanyPrimaryRaw[0] || {}
    : accountCompanyPrimaryRaw || {};
  const accountCompanyPrimary = {
    first_name:
      accountCompanyPrimaryNested?.first_name ||
      accountCompanyPrimaryNested?.First_Name ||
      accountCompany?.Primary_Person_First_Name,
    last_name:
      accountCompanyPrimaryNested?.last_name ||
      accountCompanyPrimaryNested?.Last_Name ||
      accountCompany?.Primary_Person_Last_Name,
    email:
      accountCompanyPrimaryNested?.email ||
      accountCompanyPrimaryNested?.Email ||
      accountCompany?.Primary_Person_Email,
    sms_number:
      accountCompanyPrimaryNested?.sms_number ||
      accountCompanyPrimaryNested?.SMS_Number ||
      accountCompany?.Primary_Person_SMS_Number,
  };

  const accountType = toText(loadedAccountType);
  const normalizedAccountType = accountType.toLowerCase();
  const isContactAccount = isContactAccountType(normalizedAccountType);
  const isCompanyAccount = isCompanyAccountType(normalizedAccountType);
  const isQuoteCompanyAccount = isCompanyAccountType(normalizedAccountType);

  const hasAccountContactDetails = Boolean(
    fullName(
      accountPrimaryContact?.first_name || accountPrimaryContact?.First_Name,
      accountPrimaryContact?.last_name || accountPrimaryContact?.Last_Name
    ) ||
      toText(accountPrimaryContact?.email || accountPrimaryContact?.Email) ||
      toText(accountPrimaryContact?.sms_number || accountPrimaryContact?.SMS_Number) ||
      toText(accountPrimaryContact?.address || accountPrimaryContact?.Address)
  );
  const hasAccountCompanyDetails = Boolean(
    toText(accountCompany?.name || accountCompany?.Name) ||
      toText(accountCompany?.phone || accountCompany?.Phone) ||
      toText(accountCompany?.address || accountCompany?.Address)
  );
  const companyAccountType = toText(
    accountCompany?.account_type || accountCompany?.Account_Type || accountType
  );
  const isBodyCorpAccount = isBodyCorpCompanyAccountType(companyAccountType);
  const showContactDetails = isContactAccount || (!isCompanyAccount && hasAccountContactDetails);
  const showCompanyDetails = isCompanyAccount || (!isContactAccount && hasAccountCompanyDetails);

  const contactPopupComment = toText(
    accountContactRecord?.popup_comment || accountContactRecord?.Popup_Comment
  );
  const companyPopupComment = toText(
    accountCompanyRecord?.popup_comment || accountCompanyRecord?.Popup_Comment
  );
  const hasPopupCommentsSection = Boolean(showContactDetails || showCompanyDetails);
  const hasMemoContext = Boolean(effectiveJobId);

  const contactLogsContactId = useMemo(() => {
    if (isCompanyAccount) {
      return toText(
        accountCompanyPrimaryNested?.id ||
          accountCompanyPrimaryNested?.ID ||
          accountCompany?.Primary_Person?.id ||
          accountCompany?.Primary_Person?.ID ||
          accountCompany?.primary_person?.id ||
          accountCompany?.primary_person?.ID
      );
    }
    return toText(loadedClientIndividualId);
  }, [
    accountCompany?.Primary_Person,
    accountCompany?.primary_person,
    accountCompanyPrimaryNested?.ID,
    accountCompanyPrimaryNested?.id,
    isCompanyAccount,
    loadedClientIndividualId,
  ]);

  const { profile: currentUserProfile } = useCurrentUserProfile();
  const currentUserId = toText(currentUserProfile?.id || APP_USER?.id);
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
        display_name: toText(author?.display_name || author?.Display_Name) || currentUserMemoAuthor.display_name,
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

  // Account display fields
  const accountContactName = fullName(
    accountPrimaryContact?.first_name || accountPrimaryContact?.First_Name,
    accountPrimaryContact?.last_name || accountPrimaryContact?.Last_Name
  );
  const accountContactEmail = toText(accountPrimaryContact?.email || accountPrimaryContact?.Email);
  const accountContactPhone = toText(accountPrimaryContact?.sms_number || accountPrimaryContact?.SMS_Number || accountPrimaryContact?.office_phone || accountPrimaryContact?.Office_Phone);
  const accountContactEmailHref = isLikelyEmailValue(accountContactEmail) ? toMailHref(accountContactEmail) : "";
  const accountContactPhoneHref = isLikelyPhoneValue(accountContactPhone) ? toTelHref(accountContactPhone) : "";
  const accountContactAddress = joinAddress([
    accountPrimaryContact?.address || accountPrimaryContact?.Address,
    accountPrimaryContact?.city || accountPrimaryContact?.City,
    accountPrimaryContact?.state || accountPrimaryContact?.State,
    accountPrimaryContact?.zip_code || accountPrimaryContact?.Zip_Code,
  ]);
  const accountContactAddressHref = toGoogleMapsHref(accountContactAddress);

  const accountCompanyName = toText(accountCompany?.name || accountCompany?.Name);
  const accountCompanyPhone = toText(accountCompany?.phone || accountCompany?.Phone);
  const accountCompanyPhoneHref = isLikelyPhoneValue(accountCompanyPhone) ? toTelHref(accountCompanyPhone) : "";
  const accountCompanyAddress = joinAddress([
    accountCompany?.address || accountCompany?.Address,
    accountCompany?.city || accountCompany?.City,
    accountCompany?.state || accountCompany?.State,
    accountCompany?.postal_code || accountCompany?.Postal_Code || accountCompany?.zip_code || accountCompany?.Zip_Code,
  ]);
  const accountCompanyAddressHref = toGoogleMapsHref(accountCompanyAddress);
  const accountCompanyPrimaryName = fullName(
    accountCompanyPrimary?.first_name || accountCompanyPrimary?.First_Name,
    accountCompanyPrimary?.last_name || accountCompanyPrimary?.Last_Name
  );
  const accountCompanyPrimaryEmail = toText(accountCompanyPrimary?.email || accountCompanyPrimary?.Email);
  const accountCompanyPrimaryEmailHref = isLikelyEmailValue(accountCompanyPrimaryEmail) ? toMailHref(accountCompanyPrimaryEmail) : "";
  const accountCompanyPrimaryPhone = toText(accountCompanyPrimary?.sms_number || accountCompanyPrimary?.SMS_Number);
  const accountCompanyPrimaryPhoneHref = isLikelyPhoneValue(accountCompanyPrimaryPhone) ? toTelHref(accountCompanyPrimaryPhone) : "";

  const accountBodyCorpRaw =
    accountCompany?.Body_Corporate_Company || accountCompany?.body_corporate_company || null;
  const accountBodyCorpCompany = Array.isArray(accountBodyCorpRaw)
    ? accountBodyCorpRaw[0] || {}
    : accountBodyCorpRaw || {};
  const accountBodyCorpName = toText(
    accountBodyCorpCompany?.name || accountBodyCorpCompany?.Name || accountCompany?.Body_Corporate_Company_Name
  );
  const accountBodyCorpType = toText(
    accountBodyCorpCompany?.type || accountBodyCorpCompany?.Type || accountCompany?.Body_Corporate_Company_Type
  );
  const accountBodyCorpPhone = toText(
    accountBodyCorpCompany?.phone || accountBodyCorpCompany?.Phone || accountCompany?.Body_Corporate_Company_Phone
  );
  const accountBodyCorpPhoneHref = isLikelyPhoneValue(accountBodyCorpPhone) ? toTelHref(accountBodyCorpPhone) : "";
  const accountBodyCorpAddress = joinAddress([
    accountBodyCorpCompany?.address || accountBodyCorpCompany?.Address || accountCompany?.Body_Corporate_Company_Address,
    accountBodyCorpCompany?.city || accountBodyCorpCompany?.City || accountCompany?.Body_Corporate_Company_City,
    accountBodyCorpCompany?.state || accountBodyCorpCompany?.State || accountCompany?.Body_Corporate_Company_State,
    accountBodyCorpCompany?.postal_code || accountBodyCorpCompany?.Postal_Code || accountCompany?.Body_Corporate_Company_Postal_Code,
  ]);
  const accountBodyCorpAddressHref = toGoogleMapsHref(accountBodyCorpAddress);
  const hasBodyCorpDetails = Boolean(accountBodyCorpName || accountBodyCorpType || accountBodyCorpPhone || accountBodyCorpAddress);
  const hasAccountContactFields = Boolean(accountContactName || accountContactEmail || accountContactPhone || accountContactAddress);
  const hasAccountCompanyFields = Boolean(
    accountCompanyName || accountCompanyPhone || accountCompanyPrimaryName || accountCompanyPrimaryEmail || accountCompanyPrimaryPhone || accountCompanyAddress
  );

  const activePropertyAddress = joinAddress([
    activeWorkspaceProperty?.address_1 || activeWorkspaceProperty?.Address_1 || activeWorkspaceProperty?.address,
    activeWorkspaceProperty?.suburb_town || activeWorkspaceProperty?.Suburb_Town || activeWorkspaceProperty?.city,
    activeWorkspaceProperty?.state || activeWorkspaceProperty?.State,
    activeWorkspaceProperty?.postal_code || activeWorkspaceProperty?.Postal_Code,
  ]);
  const uploadsPropertyId = toText(
    activeWorkspaceProperty?.id || activeWorkspaceProperty?.ID || activeWorkspaceProperty?.Property_ID ||
    selectedWorkspacePropertyId || loadedPropertyId
  );

  return {
    accountBodyCorpAddress, accountBodyCorpAddressHref, accountBodyCorpName, accountBodyCorpPhone,
    accountBodyCorpPhoneHref, accountBodyCorpType, accountCompany, accountCompanyAddress,
    accountCompanyAddressHref, accountCompanyName, accountCompanyPhone, accountCompanyPhoneHref,
    accountCompanyPrimary, accountCompanyPrimaryEmail, accountCompanyPrimaryEmailHref,
    accountCompanyPrimaryName, accountCompanyPrimaryPhone, accountCompanyPrimaryPhoneHref,
    accountContactAddress, accountContactAddressHref, accountContactEmail, accountContactEmailHref,
    accountContactName, accountContactPhone, accountContactPhoneHref, accountPrimaryContact,
    accountType, activePropertyAddress, companyAccountType, companyPopupComment,
    contactLogsContactId, contactPopupComment, currentUserId, currentUserMemoAuthor,
    hasAccountCompanyFields, hasAccountContactFields, hasBodyCorpDetails, hasMemoContext,
    hasPopupCommentsSection, isBodyCorpAccount, isCompanyAccount, isContactAccount,
    isQuoteCompanyAccount, normalizedAccountType, resolveMemoAuthor, showCompanyDetails,
    showContactDetails, uploadsPropertyId,
  };
}
