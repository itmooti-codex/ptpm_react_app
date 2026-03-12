import {
  extractFirstRecord,
} from "@modules/details-workspace/exports/api.js";
import { toPromiseLike } from "@modules/details-workspace/api/core/transport.js";
import {
  findContactByEmail,
  searchCompaniesForLookup,
  searchContactsForLookup,
} from "@modules/details-workspace/api/core/runtime.js";
import { toText } from "@shared/utils/formatters.js";
import {
  normalizeComparableText,
  resolveLookupRecordId,
} from "../shared/quickInquiryHelpers.js";
import { normalizeMutationIdentifier } from "./inquiryCoreApi.js";

export async function fetchCompanyByExactName({ plugin, companyName } = {}) {
  const normalizedName = normalizeComparableText(companyName);
  if (!plugin?.switchTo || !normalizedName) return null;

  const runDetailQuery = async (whereField, whereValue) => {
    const query = plugin
      .switchTo("PeterpmCompany")
      .query()
      .where(whereField, whereValue)
      .deSelectAll()
      .select([
        "id",
        "name",
        "phone",
        "address",
        "city",
        "state",
        "postal_code",
        "account_type",
      ])
      .include("Primary_Person", (personQuery) =>
        personQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
      )
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    return extractFirstRecord(result);
  };

  try {
    const direct = await runDetailQuery("name", companyName);
    if (normalizeComparableText(direct?.name || direct?.Name) === normalizedName) {
      return direct;
    }
  } catch (_) {}

  const fallbackMatches = await searchCompaniesForLookup({
    plugin,
    query: normalizedName,
    limit: 40,
  }).catch(() => []);
  const fallbackRecord = (Array.isArray(fallbackMatches) ? fallbackMatches : []).find(
    (record) => normalizeComparableText(record?.name || record?.Name) === normalizedName
  );
  const fallbackId = resolveLookupRecordId(fallbackRecord, "Company");
  if (!fallbackId) return null;

  try {
    return await runDetailQuery("id", normalizeMutationIdentifier(fallbackId));
  } catch (_) {
    return fallbackRecord || null;
  }
}

export async function fetchContactByExactEmail({ plugin, email } = {}) {
  const normalizedEmail = toText(email).trim().toLowerCase();
  if (!plugin?.switchTo || !normalizedEmail) return null;

  try {
    const direct = await findContactByEmail({ plugin, email: normalizedEmail });
    if (normalizeComparableText(direct?.email || direct?.Email) === normalizedEmail) {
      return direct;
    }
  } catch (_) {}

  const fallbackMatches = await searchContactsForLookup({
    plugin,
    query: normalizedEmail,
    limit: 40,
  }).catch(() => []);
  const fallbackRecord = (Array.isArray(fallbackMatches) ? fallbackMatches : []).find(
    (record) => normalizeComparableText(record?.email || record?.Email) === normalizedEmail
  );
  const fallbackId = resolveLookupRecordId(fallbackRecord, "Contact");
  if (!fallbackId) return fallbackRecord || null;

  try {
    const detailQuery = plugin
      .switchTo("PeterpmContact")
      .query()
      .where("id", normalizeMutationIdentifier(fallbackId))
      .deSelectAll()
      .select([
        "id",
        "first_name",
        "last_name",
        "email",
        "sms_number",
        "address",
        "city",
        "state",
        "zip_code",
        "country",
      ])
      .limit(1)
      .noDestroy();
    detailQuery.getOrInitQueryCalc?.();
    const detailResult = await toPromiseLike(detailQuery.fetchDirect());
    return extractFirstRecord(detailResult) || fallbackRecord || null;
  } catch (_) {
    return fallbackRecord || null;
  }
}

export async function fetchServiceProviderById({ plugin, providerId }) {
  const normalizedId = toText(providerId);
  if (!plugin?.switchTo || !normalizedId) return null;

  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  const runQuery = async ({ field, value }) => {
    const query = providerModel
      .query()
      .where(field, value)
      .deSelectAll()
      .select(["id", "unique_id", "type", "status", "work_email", "mobile_number"])
      .include("Contact_Information", (contactQuery) =>
        contactQuery.deSelectAll().select(["first_name", "last_name"])
      )
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    return extractFirstRecord(result);
  };

  const byId = await runQuery({
    field: "id",
    value: /^\d+$/.test(normalizedId) ? Number.parseInt(normalizedId, 10) : normalizedId,
  });
  if (byId) return byId;

  const byUniqueId = await runQuery({ field: "unique_id", value: normalizedId });
  if (byUniqueId) return byUniqueId;

  return null;
}
