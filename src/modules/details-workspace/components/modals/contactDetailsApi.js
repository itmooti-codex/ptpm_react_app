import { toPromiseLike, trimValue } from "./contactDetailsUtils.js";
import {
  searchCompaniesForLookup,
} from "../../api/core/runtime.js";

export async function fetchCompanyById({ plugin, companyId }) {
  if (!plugin?.switchTo) return null;
  const id = trimValue(companyId);
  if (!id) return null;
  const query = plugin
    .switchTo("PeterpmCompany")
    .query()
    .where("id", id)
    .deSelectAll()
    .select([
      "id",
      "name",
      "type",
      "description",
      "phone",
      "address",
      "city",
      "state",
      "postal_code",
      "industry",
      "annual_revenue",
      "number_of_employees",
      "account_type",
      "popup_comment",
    ])
    .include("Primary_Person", (personQuery) =>
      personQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
    )
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const response = await toPromiseLike(query.fetchDirect());
  const rows = response?.resp || response?.data || [];
  return Array.isArray(rows) && rows.length ? rows[0] || null : null;
}

export async function fetchContactById({ plugin, contactId }) {
  if (!plugin?.switchTo) return null;
  const id = trimValue(contactId);
  if (!id) return null;
  const query = plugin
    .switchTo("PeterpmContact")
    .query()
    .where("id", id)
    .deSelectAll()
    .select([
      "id",
      "first_name",
      "last_name",
      "email",
      "sms_number",
      "office_phone",
      "lot_number",
      "unit_number",
      "address",
      "city",
      "state",
      "zip_code",
      "country",
      "postal_address",
      "postal_city",
      "postal_state",
      "postal_country",
      "postal_code",
    ])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const response = await toPromiseLike(query.fetchDirect());
  const rows = response?.resp || response?.data || [];
  return Array.isArray(rows) && rows.length ? rows[0] || null : null;
}

export async function findCompanyByName({ plugin, name }) {
  const companyName = trimValue(name);
  if (!plugin?.switchTo || !companyName) return null;

  try {
    const directQuery = plugin
      .switchTo("PeterpmCompany")
      .query()
      .where("name", companyName)
      .deSelectAll()
      .select(["id", "name"])
      .limit(1)
      .noDestroy();
    directQuery.getOrInitQueryCalc?.();
    const directResponse = await toPromiseLike(directQuery.fetchDirect());
    const directRows = directResponse?.resp || directResponse?.data || [];
    const directRecord = Array.isArray(directRows) && directRows.length ? directRows[0] || null : null;
    const directId = trimValue(directRecord?.id || directRecord?.ID);
    if (directId) {
      const detailed = await fetchCompanyById({ plugin, companyId: directId });
      return detailed || directRecord;
    }
  } catch (lookupError) {
    console.warn("[JobDirect] Company direct-name lookup failed", lookupError);
  }

  try {
    const results = await searchCompaniesForLookup({
      plugin,
      query: companyName,
      limit: 20,
    });
    const normalizedTarget = companyName.toLowerCase();
    const matched = (Array.isArray(results) ? results : []).find(
      (item) => trimValue(item?.name || item?.Name).toLowerCase() === normalizedTarget
    );
    const matchedId = trimValue(matched?.id || matched?.ID);
    if (!matchedId) return null;
    const detailed = await fetchCompanyById({ plugin, companyId: matchedId });
    return detailed || matched;
  } catch (lookupError) {
    console.error("[JobDirect] Company duplicate lookup failed", lookupError);
    return null;
  }
}
