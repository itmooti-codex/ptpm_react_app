export function resolvePlugin(plugin) {
  return (
    plugin ||
    window.getVitalStatsPlugin?.() ||
    window.__ptpmVitalStatsPlugin ||
    window.tempPlugin ||
    window.plugin ||
    null
  );
}
