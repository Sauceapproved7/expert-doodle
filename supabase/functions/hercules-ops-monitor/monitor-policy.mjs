export const NONCRITICAL_SLICE_SIZE = 4;

export function selectMonitorBatch(services = [], noncriticalOffset = 0) {
  const enabled = services
    .filter((service) => service?.enabled !== false)
    .map((service) => ({ ...service }))
    .sort((a, b) => String(a.service_slug).localeCompare(String(b.service_slug)));

  const critical = enabled.filter((service) => service.critical === true);
  const noncritical = enabled.filter((service) => service.critical !== true);

  const offset = noncritical.length
    ? Math.max(0, Number(noncriticalOffset) || 0) % noncritical.length
    : 0;

  const noncriticalSlice = [];
  const sliceSize = Math.min(NONCRITICAL_SLICE_SIZE, noncritical.length);
  for (let i = 0; i < sliceSize; i += 1) {
    noncriticalSlice.push(noncritical[(offset + i) % noncritical.length]);
  }

  const nextNoncriticalOffset = noncritical.length
    ? (offset + noncriticalSlice.length) % noncritical.length
    : 0;

  return Object.freeze({
    selected: Object.freeze([...critical, ...noncriticalSlice]),
    critical: Object.freeze(critical),
    noncriticalSlice: Object.freeze(noncriticalSlice),
    nextNoncriticalOffset,
    enabledTotal: enabled.length,
    criticalTotal: critical.length,
    noncriticalTotal: noncritical.length,
  });
}
