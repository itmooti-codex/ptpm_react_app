import { resolvePlugin } from "../../plugin.js";
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
