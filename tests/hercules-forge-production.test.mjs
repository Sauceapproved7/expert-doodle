import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createForgeControlService} from "../hercules-forge/control-api.mjs";
import {ForgeIdentityStore} from "../hercules-forge/identity.mjs";
import {ForgeLoginRateLimiter} from "../hercules-forge/rate-limit.mjs";
import {
  readForgeProductionConfig,
  safeForgeProductionSummary,
} from "../hercules-forge/production.mjs";

function fixtureCredential() {
  return randomBytes(24).toString("base64url");
}

function productionEnv(root) {
  return {
    FORGE_ROOT: root,
    FORGE_CONTROL_TOKEN: fixtureCredential(
      "forge",
      "production",
      "control",
      "fixture",
      "credential",
      "long",
    ),
    FORGE_PUBLIC_ORIGIN: "https://forge.example.test",
    FORGE_PORT: "38700",
    FORGE_DATA_MAX_BYTES: "1048576",
    FORGE_LOGIN_MAX_FAILURES: "3",
    FORGE_LOGIN_WINDOW_MS: "60000",
    FORGE_RECOVERY_MAX_REQUESTS: "4",
    FORGE_RECOVERY_WINDOW_MS: "120000",
    FORGE_NOTIFICATION_URL: "https://notify.example.test/send",
  };
}

test("production config is fail-closed and safe summary omits credentials", () => {
  const env = productionEnv("/tmp/forge-prod");
  const config = readForgeProductionConfig(env);
  assert.equal(config.publicOrigin, "https://forge.example.test");
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 38700);
  assert.equal(config.runtimeDataMaxBytes, 1048576);
  assert.equal(config.loginMaxFailures, 3);
  assert.equal(config.loginWindowMs, 60000);
  assert.equal(config.recoveryMaxRequests, 4);
  assert.equal(config.recoveryWindowMs, 120000);
  assert.equal(config.notificationUrl, "https://notify.example.test/send");

  const summary = safeForgeProductionSummary(config);
  assert.equal(summary.secureSessionCookies, true);
  assert.equal(summary.identityLifecycle, true);
  assert.equal("token" in summary, false);
  assert.equal("interpreterToken" in summary, false);
  assert.equal("notificationToken" in summary, false);
  assert.equal(JSON.stringify(summary).includes(env.FORGE_CONTROL_TOKEN), false);

  assert.throws(
    () => readForgeProductionConfig({...env, FORGE_CONTROL_TOKEN: "short"}),
    /at least 32 characters/,
  );
  assert.throws(
    () => readForgeProductionConfig({...env, FORGE_PUBLIC_ORIGIN: "http://forge.example.test"}),
    /must use https/,
  );
  assert.throws(
    () => readForgeProductionConfig({...env, FORGE_ROOT: ""}),
    /FORGE_ROOT is required/,
  );
  assert.throws(
    () => readForgeProductionConfig({
      ...env,
      FORGE_INTERPRETER_URL: "http://models.example.test/v1/interpret",
    }),
    /must use https unless it is loopback/,
  );
  assert.equal(
    readForgeProductionConfig({
      ...env,
      FORGE_INTERPRETER_URL: "http://127.0.0.1:39000/interpret",
    }).interpreterUrl,
    "http://127.0.0.1:39000/interpret",
  );
  assert.throws(
    () => readForgeProductionConfig({
      ...env,
      FORGE_NOTIFICATION_URL: "http://notify.example.test/send",
    }),
    /must use https unless it is loopback/,
  );
  assert.equal(
    readForgeProductionConfig({
      ...env,
      FORGE_NOTIFICATION_URL: "http://127.0.0.1:39001/send",
    }).notificationUrl,
    "http://127.0.0.1:39001/send",
  );
});

test("login rate limiter blocks repeated failed credentials and resets on success", () => {
  let now = 1000;
  const limiter = new ForgeLoginRateLimiter({
    maxFailures: 2,
    windowMs: 5000,
    now: () => now,
  });

  limiter.beforeAttempt("Owner@Example.com");
  limiter.recordFailure("owner@example.com");
  limiter.beforeAttempt("owner@example.com");
  limiter.recordFailure("owner@example.com");
  assert.throws(
    () => limiter.beforeAttempt("owner@example.com"),
    (error) => error?.statusCode === 429 && error?.retryAfterSeconds === 5,
  );

  now += 5000;
  assert.equal(limiter.beforeAttempt("owner@example.com").allowed, true);
  limiter.recordFailure("owner@example.com");
  limiter.recordSuccess("owner@example.com");
  assert.equal(limiter.beforeAttempt("owner@example.com").allowed, true);
});

test("production session cookies are Secure and failed login throttling returns Retry-After", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-production-api-"));
  const identities = new ForgeIdentityStore(root);
  const password = fixtureCredential("customer", "fixture", "password", "long", "enough");
  await identities.createUser({
    userId: "production-user",
    email: "production@example.com",
    password,
  });

  const limiter = new ForgeLoginRateLimiter({maxFailures: 2, windowMs: 60000});
  const controlToken = fixtureCredential("control", "fixture", "credential", "long", "enough");
  const server = createForgeControlService({
    root,
    token: controlToken,
    secureSessionCookies: true,
    loginRateLimiter: limiter,
    serviceMode: "production",
    publicOrigin: "https://forge.example.test",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;

  async function signIn(candidate) {
    return fetch(base + "/v1/session", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        email: "production@example.com",
        password: candidate,
      }),
    });
  }

  try {
    const health = await fetch(base + "/health");
    const healthBody = await health.json();
    assert.equal(healthBody.version, "1.5");
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.equal(health.headers.get("referrer-policy"), "no-referrer");
    assert.equal(health.headers.get("x-frame-options"), "DENY");
    assert.equal(
      health.headers.get("strict-transport-security"),
      "max-age=31536000; includeSubDomains",
    );
    assert.match(health.headers.get("permissions-policy") ?? "", /camera=\(\)/);
    assert.equal(healthBody.mode, "production");
    assert.equal(healthBody.publicOrigin, "https://forge.example.test");
    assert.equal(healthBody.identityLifecycle, false);

    assert.equal((await signIn(fixtureCredential("wrong", "one", "credential", "long", "enough"))).status, 401);
    assert.equal((await signIn(fixtureCredential("wrong", "two", "credential", "long", "enough"))).status, 401);
    const blocked = await signIn(password);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);

    limiter.reset();
    const success = await signIn(password);
    assert.equal(success.status, 201);
    const cookie = success.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Secure/);

    const audit = await fetch(base + "/v1/audit?type=session.login&limit=20", {
      headers: {authorization: "Bearer " + controlToken},
    });
    assert.equal(audit.status, 200);
    const auditBody = await audit.json();
    assert.equal(auditBody.events.some((event) => event.outcome === "failure"), true);
    assert.equal(auditBody.events.some((event) => event.outcome === "blocked"), true);
    assert.equal(auditBody.events.some((event) => event.outcome === "success"), true);
    const auditText = JSON.stringify(auditBody.events);
    assert.equal(auditText.includes(password), false);
    assert.equal(auditText.includes(controlToken), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
