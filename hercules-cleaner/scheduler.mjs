const DAY_MS = 24 * 60 * 60 * 1000;

export function shouldRunSchedule({schedule, lastRunAt = null, now = Date.now()} = {}) {
  if (!schedule || schedule.enabled === false) return false;
  const last = lastRunAt == null ? null : Number(lastRunAt);
  switch (schedule.type) {
    case "afterSession":
      return false;
    case "hourly": {
      const hours = Math.max(1, Number(schedule.hours ?? 1));
      return last == null || now - last >= hours * 60 * 60 * 1000;
    }
    case "daily":
      return last == null || now - last >= DAY_MS;
    case "everyNDays": {
      const days = Math.max(1, Number(schedule.days ?? 1));
      return last == null || now - last >= days * DAY_MS;
    }
    case "weekly":
      return last == null || now - last >= 7 * DAY_MS;
    case "lowStorage":
      return false;
    default:
      throw new Error(`unsupported schedule type: ${schedule.type}`);
  }
}

export function nextRunAt({schedule, lastRunAt = null, now = Date.now()} = {}) {
  if (!schedule || schedule.enabled === false || schedule.type === "afterSession" || schedule.type === "lowStorage") return null;
  const base = lastRunAt == null ? now : Number(lastRunAt);
  const interval = schedule.type === "hourly"
    ? Math.max(1, Number(schedule.hours ?? 1)) * 60 * 60 * 1000
    : schedule.type === "daily"
      ? DAY_MS
      : schedule.type === "weekly"
        ? 7 * DAY_MS
        : Math.max(1, Number(schedule.days ?? 1)) * DAY_MS;
  return new Date(base + interval).toISOString();
}
