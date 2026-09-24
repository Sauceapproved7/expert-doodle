export class ForgeLoginRateLimiter {
  constructor({maxFailures = 8, windowMs = 5 * 60 * 1000, now = () => Date.now()} = {}) {
    if (!Number.isSafeInteger(maxFailures) || maxFailures < 1) {
      throw new TypeError("maxFailures must be a positive integer");
    }
    if (!Number.isSafeInteger(windowMs) || windowMs < 1000) {
      throw new TypeError("windowMs must be an integer >= 1000");
    }
    if (typeof now !== "function") throw new TypeError("now must be a function");
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.now = now;
    this.entries = new Map();
  }

  normalizeKey(key) {
    const normalized = String(key ?? "").trim().toLowerCase();
    return normalized || "<unknown>";
  }

  current(key) {
    key = this.normalizeKey(key);
    const entry = this.entries.get(key);
    if (!entry) return {key, failures: 0, startedAt: this.now()};
    if (this.now() - entry.startedAt >= this.windowMs) {
      this.entries.delete(key);
      return {key, failures: 0, startedAt: this.now()};
    }
    return {key, ...entry};
  }

  beforeAttempt(key) {
    const entry = this.current(key);
    if (entry.failures < this.maxFailures) {
      return {
        allowed: true,
        remainingFailures: this.maxFailures - entry.failures,
        retryAfterSeconds: 0,
      };
    }
    const retryMs = Math.max(0, this.windowMs - (this.now() - entry.startedAt));
    throw Object.assign(new Error("too many failed sign-in attempts"), {
      statusCode: 429,
      retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
    });
  }

  recordFailure(key) {
    key = this.normalizeKey(key);
    const entry = this.current(key);
    const next = {
      failures: entry.failures + 1,
      startedAt: entry.failures === 0 ? this.now() : entry.startedAt,
    };
    this.entries.set(key, next);
    return {
      failures: next.failures,
      remainingFailures: Math.max(0, this.maxFailures - next.failures),
    };
  }

  recordSuccess(key) {
    this.entries.delete(this.normalizeKey(key));
  }

  reset() {
    this.entries.clear();
  }
}
