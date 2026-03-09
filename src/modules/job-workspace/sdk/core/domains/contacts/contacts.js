import { resolvePlugin } from "../../plugin.js";
import { toPromiseLike } from "../../transport.js";
import { extractFirstRecord } from "../../../utils/sdkResponseUtils.js";
import {
  normalizeIdentifier,
} from "../shared/sharedHelpers.js";
import {
  parseContactCreateMutationResult,
  parseContactUpdateMutationResult,
  parseCompanyCreateMutationResult,
} from "./contactsMutationResultHelpers.js";

function prepareContactMutationPayload(payload = {}) {
  const source = payload && typeof payload === "object" ? { ...payload } : {};
  delete source.id;
  delete source.ID;
  delete source.Contact_ID;
  return source;
}

function prepareCompanyMutationPayload(payload = {}) {
  const source = payload && typeof payload === "object" ? { ...payload } : {};
  delete source.id;
  delete source.ID;
  delete source.Company_ID;

  if (source.Primary_Person && typeof source.Primary_Person === "object") {
    const primaryPerson = { ...source.Primary_Person };
    delete primaryPerson.id;
    delete primaryPerson.ID;
    delete primaryPerson.Contact_ID;
    source.Primary_Person = primaryPerson;
  }

  return source;
}

export async function createContactRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const contactModel = resolvedPlugin.switchTo("PeterpmContact");
  if (!contactModel?.mutation) {
    throw new Error("Contact model is unavailable.");
  }

  const mutation = await contactModel.mutation();
  mutation.createOne(prepareContactMutationPayload(payload || {}));
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: resolvedId } = parseContactCreateMutationResult(result);

  return {
    ...payload,
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  };
}

export async function updateContactRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Contact ID is missing.");
  }

  const contactModel = resolvedPlugin.switchTo("PeterpmContact");
  if (!contactModel?.mutation) {
    throw new Error("Contact model is unavailable.");
  }

  const mutation = await contactModel.mutation();
  mutation.update((query) =>
    query.where("id", normalizedId).set(prepareContactMutationPayload(payload || {}))
  );
  const result = await mutation.execute(true).toPromise();
  const { record: updatedRecord, mutationId: createdId } =
    parseContactUpdateMutationResult(result);

  if (updatedRecord === null || (!updatedRecord && !createdId)) {
    console.warn(
      "[JobDirect] Contact update returned no updated record. Treating as success.",
      result
    );
  }

  return {
    ...payload,
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || createdId || normalizedId),
  };
}

export async function createCompanyRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const companyModel = resolvedPlugin.switchTo("PeterpmCompany");
  if (!companyModel?.mutation) {
    throw new Error("Company model is unavailable.");
  }

  const mutation = await companyModel.mutation();
  mutation.createOne(prepareCompanyMutationPayload(payload || {}));
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: resolvedId } = parseCompanyCreateMutationResult(result);

  return {
    ...payload,
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  };
}

export async function fetchCompanyAccountRecordById({ plugin, companyId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return null;
  const normalizedId = normalizeIdentifier(companyId);
  if (!normalizedId) return null;
  const query = resolvedPlugin
    .switchTo("PeterpmCompany")
    .query()
    .where("id", normalizedId)
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
      "xero_contact_id",
    ])
    .include("Primary_Person", (personQuery) =>
      personQuery
        .deSelectAll()
        .select(["id", "first_name", "last_name", "email", "sms_number"])
    )
    .include("Body_Corporate_Company", (bodyCorpQuery) =>
      bodyCorpQuery
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
        ])
    )
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

export async function fetchContactAccountRecordById({ plugin, contactId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return null;
  const normalizedId = normalizeIdentifier(contactId);
  if (!normalizedId) return null;
  const query = resolvedPlugin
    .switchTo("PeterpmContact")
    .query()
    .where("id", normalizedId)
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
      "xero_contact_id",
    ])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}
