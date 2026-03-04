import { VITAL_STATS_CONFIG } from "./config.js";

const SDK_SCRIPT_SRC = "https://static-au03.vitalstats.app/static/sdk/v1/latest.js";

let sdkScriptPromise = null;
let sdkInitPromise = null;

function getInitFunction() {
  return window.initVitalStats || window.initVitalStatsSDK || null;
}

async function loadSdkScript() {
  if (getInitFunction()) return;
  if (sdkScriptPromise) return sdkScriptPromise;

  sdkScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load VitalStats SDK script")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.chunk = "client";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load VitalStats SDK script"));
    document.head.appendChild(script);
  }).catch((error) => {
    sdkScriptPromise = null;
    throw error;
  });

  return sdkScriptPromise;
}

export async function ensureVitalStatsPlugin(customConfig = {}) {
  const existingPlugin =
    window.getVitalStatsPlugin?.() ||
    window.__ptpmVitalStatsPlugin ||
    window.tempPlugin ||
    window.plugin ||
    null;
  if (existingPlugin) return existingPlugin;

  if (sdkInitPromise) return sdkInitPromise;

  const { slug, apiKey } = { ...VITAL_STATS_CONFIG, ...customConfig };
  if (!slug || !apiKey) {
    throw new Error("VitalStats config missing slug/apiKey");
  }

  sdkInitPromise = (async () => {
    await loadSdkScript();
    const initFn = getInitFunction();
    if (!initFn) throw new Error("VitalStats init function missing on window");

    const result = await initFn({
      slug,
      apiKey,
      isDefault: true,
    }).toPromise();
    const plugin = result?.plugin || window.getVitalStatsPlugin?.() || null;
    if (!plugin) throw new Error("VitalStats plugin not available after init");

    window.__ptpmVitalStatsPlugin = plugin;
    return plugin;
  })().catch((error) => {
    sdkInitPromise = null;
    throw error;
  });

  return sdkInitPromise;
}
