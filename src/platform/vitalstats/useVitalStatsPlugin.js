import { useEffect, useState } from "react";
import { ensureVitalStatsPlugin } from "./bootstrap.js";

export function useVitalStatsPlugin() {
  const [plugin, setPlugin] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;

    ensureVitalStatsPlugin()
      .then((resolvedPlugin) => {
        if (!isActive) return;
        setPlugin(resolvedPlugin);
        setIsReady(true);
      })
      .catch((sdkError) => {
        if (!isActive) return;
        console.error("[JobDirect] SDK initialization failed", sdkError);
        setError(sdkError);
        setIsReady(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return { plugin, isReady, error };
}
