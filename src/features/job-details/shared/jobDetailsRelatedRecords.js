import { toText } from "@shared/utils/formatters.js";

function getRelatedRecordIdentity(record = {}, index = 0, fallbackPrefix = "record") {
  const uid = toText(record?.unique_id || record?.Unique_ID);
  const id = toText(record?.id || record?.ID);
  return {
    uid,
    id,
    fallbackKey: `${fallbackPrefix}:${index}`,
  };
}

export function getRelatedDealRecordKey(record = {}, index = 0) {
  const uid = toText(record?.unique_id || record?.Unique_ID);
  if (uid) return `uid:${uid}`;
  const id = toText(record?.id || record?.ID);
  if (id) return `id:${id}`;
  return `deal:${index}`;
}

export function getRelatedJobRecordKey(record = {}, index = 0) {
  const uid = toText(record?.unique_id || record?.Unique_ID);
  if (uid) return `uid:${uid}`;
  const id = toText(record?.id || record?.ID);
  if (id) return `id:${id}`;
  return `job:${index}`;
}

export function mergeRelatedRecordCollections(baseRecords = [], contextualRecords = [], getKey) {
  const list = Array.isArray(baseRecords) ? baseRecords : [];
  const contextual = Array.isArray(contextualRecords) ? contextualRecords : [];
  const merged = [];
  const indexByKey = new Map();

  [...list, ...contextual].forEach((record, index) => {
    if (!record || typeof record !== "object") return;
    const { uid, id, fallbackKey } = getRelatedRecordIdentity(
      record,
      index,
      typeof getKey === "function" ? getKey(record, index).split(":")[0] : "record"
    );
    const candidateKeys = [uid ? `uid:${uid}` : "", id ? `id:${id}` : ""].filter(Boolean);
    const existingIndex = candidateKeys.reduce((foundIndex, key) => {
      if (foundIndex != null) return foundIndex;
      return indexByKey.has(key) ? indexByKey.get(key) : null;
    }, null);

    if (existingIndex == null && !candidateKeys.length) {
      merged.push(record);
      return;
    }

    if (existingIndex == null) {
      candidateKeys.forEach((key) => {
        indexByKey.set(key, merged.length);
      });
      if (!candidateKeys.length) {
        indexByKey.set(fallbackKey, merged.length);
      }
      merged.push(record);
      return;
    }

    merged[existingIndex] = {
      ...merged[existingIndex],
      ...record,
    };

    const mergedRecord = merged[existingIndex];
    const mergedUid = toText(mergedRecord?.unique_id || mergedRecord?.Unique_ID);
    const mergedId = toText(mergedRecord?.id || mergedRecord?.ID);
    if (mergedUid) indexByKey.set(`uid:${mergedUid}`, existingIndex);
    if (mergedId) indexByKey.set(`id:${mergedId}`, existingIndex);
  });

  return merged;
}
