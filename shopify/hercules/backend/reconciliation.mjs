export function reconciliationWindow({ watermark, now = new Date(), overlapMs = 5 * 60 * 1000 } = {}) {
  const end = new Date(now);
  if (Number.isNaN(end.getTime())) throw new Error("invalid_now");
  const previous = watermark == null ? end : new Date(watermark);
  if (Number.isNaN(previous.getTime())) throw new Error("invalid_watermark");
  if (!Number.isSafeInteger(overlapMs) || overlapMs < 0) throw new Error("invalid_overlap");
  const start = new Date(Math.min(previous.getTime(), end.getTime()) - overlapMs);
  return { start, end };
}

export function advanceWatermark({ complete, previous, candidate } = {}) {
  const prior = new Date(previous);
  const next = new Date(candidate);
  if (Number.isNaN(prior.getTime()) || Number.isNaN(next.getTime())) throw new Error("invalid_watermark");
  if (!complete) return prior;
  return next > prior ? next : prior;
}
