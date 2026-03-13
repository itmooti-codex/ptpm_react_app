import { fetchDirectWithTimeout, extractFromPayload } from "@shared/api/dashboardCore.js";

// ─── fetchServiceProviders ────────────────────────────────────────────────────

function getModels(plugin) {
  return {
    dealModel: plugin.switchTo("PeterpmDeal"),
    jobModel: plugin.switchTo("PeterpmJob"),
    spModel: plugin.switchTo("PeterpmServiceProvider"),
  };
}

export async function fetchServiceProviders({ plugin } = {}) {
  if (!plugin) return [];
  const mapServiceProviderRows = (rows) =>
    rows
      .map((rec) => {
        const id = String(rec.id ?? rec.ID ?? "").trim();
        const firstName = String(
          rec?.contact_information_first_name ??
            rec?.Contact_Information_First_Name ??
            rec?.Contact_Information?.first_name ??
            ""
        ).trim();
        const lastName = String(
          rec?.contact_information_last_name ??
            rec?.Contact_Information_Last_Name ??
            rec?.Contact_Information?.last_name ??
            ""
        ).trim();
        const name = [firstName, lastName].filter(Boolean).join(" ").trim();
        return { id, name };
      })
      .filter((sp) => sp.id && sp.name)
      .sort((a, b) => a.name.localeCompare(b.name));

  try {
    const { spModel } = getModels(plugin);
    const gqlQuery = spModel.query().fromGraphql(`
      query calcServiceProviders {
        calcServiceProviders(
          query: [
            { where: { type: "Service Provider" } }
          ]
        ) {
          ID: field(arg: ["id"])
          Contact_Information_First_Name: field(arg: ["Contact_Information", "first_name"])
          Contact_Information_Last_Name: field(arg: ["Contact_Information", "last_name"])
        }
      }
    `);
    const res = await fetchDirectWithTimeout(gqlQuery, null, 12000);
    const records = extractFromPayload(res);
    const mapped = mapServiceProviderRows(records);
    if (mapped.length) return mapped;
  } catch (err) {
    console.warn("[dashboardSdk] custom service provider query failed, using include fallback", err);
  }

  try {
    const { spModel } = getModels(plugin);
    const q = spModel
      .query()
      .deSelectAll()
      .select(["id", "type"])
      .where("type", "Service Provider")
      .include("Contact_Information", (sq) =>
        sq.deSelectAll().select(["first_name", "last_name"])
      )
      .limit(100)
      .noDestroy();
    q.getOrInitQueryCalc?.();
    const res = await fetchDirectWithTimeout(q, null, 12000);
    const records = Array.isArray(res?.resp) ? res.resp : [];
    return mapServiceProviderRows(records);
  } catch (err) {
    console.error("[dashboardSdk] fetchServiceProviders failed", err);
    return [];
  }
}
