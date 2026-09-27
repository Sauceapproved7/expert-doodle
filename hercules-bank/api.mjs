import http from "node:http";

import {verifyJwtHs256} from "../hercules-base/auth-core.mjs";

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_ADMIN_ROLES = Object.freeze(["owner", "admin", "staging_admin"]);

function send(res, status, body) {
  res.writeHead(status, {
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "pragma":"no-cache",
    "x-content-type-options":"nosniff",
    "x-frame-options":"DENY",
    "referrer-policy":"no-referrer",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw Object.assign(new Error("request body too large"), {statusCode:413});
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("invalid JSON body"), {statusCode:400});
  }
}

function routeParts(url) {
  try {
    return url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch (error) {
    if (error instanceof URIError) {
      throw Object.assign(new Error("malformed path encoding"), {statusCode:400});
    }
    throw error;
  }
}

function claimsFromRequest(req, {jwtSecret, issuer, audience, nowSeconds}) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    throw Object.assign(new Error("unauthorized"), {statusCode:401});
  }
  try {
    return verifyJwtHs256(header.slice(7), jwtSecret, {
      issuer,
      audience,
      nowSeconds:nowSeconds(),
    });
  } catch {
    throw Object.assign(new Error("unauthorized"), {statusCode:401});
  }
}

function requireAdmin(claims, adminRoles) {
  if (!adminRoles.has(claims.role)) {
    throw Object.assign(new Error("forbidden"), {statusCode:403});
  }
}

function ownedAccount(runtime, accountId, subject) {
  let account;
  try {
    account = runtime.getAccount(accountId);
  } catch {
    throw Object.assign(new Error("not_found"), {statusCode:404});
  }
  if (account.customerId !== subject) {
    throw Object.assign(new Error("not_found"), {statusCode:404});
  }
  return account;
}

function publicAccount(account, {includeCustomerId = true} = {}) {
  const result = {
    id:account.id,
    currency:account.currency,
    status:account.status,
    mode:account.mode,
    balanceMinor:account.balanceMinor,
  };
  if (includeCustomerId) result.customerId = account.customerId;
  return result;
}

function errorStatus(error) {
  if (Number.isInteger(error?.statusCode)) return error.statusCode;
  if (error instanceof TypeError || error instanceof RangeError) return 400;
  const message = String(error?.message ?? "");
  if (/unknown customer account|not_found/i.test(message)) return 404;
  if (/already exists|idempotency|negative|insufficient|overdraft/i.test(message)) return 409;
  return 500;
}

export function createHerculesBankApi({
  runtime,
  jwtSecret,
  issuer = "hercules-base",
  audience = "hercules-base-api",
  nowSeconds = () => Math.floor(Date.now() / 1000),
  adminRoles = DEFAULT_ADMIN_ROLES,
} = {}) {
  if (!runtime || typeof runtime.openCustomerAccount !== "function") {
    throw new TypeError("Hercules Bank runtime is required");
  }
  if (typeof jwtSecret !== "string" || Buffer.byteLength(jwtSecret) < 32) {
    throw new TypeError("JWT secret must be at least 32 bytes");
  }
  if (typeof issuer !== "string" || !issuer) throw new TypeError("JWT issuer is required");
  if (typeof audience !== "string" || !audience) throw new TypeError("JWT audience is required");
  if (typeof nowSeconds !== "function") throw new TypeError("nowSeconds must be a function");

  const allowedAdminRoles = new Set(adminRoles);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://hercules-bank.local");
      const route = routeParts(url);

      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, {
          ok:true,
          service:"hercules-bank",
          version:"0.3",
          mode:runtime.mode,
          currency:runtime.currency,
          externalRails:false,
        });
      }

      const claims = claimsFromRequest(req, {
        jwtSecret,
        issuer,
        audience,
        nowSeconds,
      });

      if (req.method === "GET" && url.pathname === "/v1/accounts") {
        return send(res, 200, {
          accounts:runtime.listAccountsForCustomer(claims.sub).map((account) => publicAccount(account)),
        });
      }

      if (req.method === "POST" && url.pathname === "/v1/accounts") {
        await readBody(req);
        const account = await runtime.openCustomerAccount({customerId:claims.sub});
        return send(res, 201, {account:publicAccount(account)});
      }

      if (route[0] === "v1" && route[1] === "accounts" && route[2]) {
        const accountId = route[2];

        if (req.method === "GET" && route.length === 3) {
          return send(res, 200, {
            account:publicAccount(ownedAccount(runtime, accountId, claims.sub)),
          });
        }

        if (
          req.method === "GET"
          && route.length === 4
          && route[3] === "statement"
        ) {
          ownedAccount(runtime, accountId, claims.sub);
          return send(res, 200, {statement:runtime.statement(accountId)});
        }
      }

      if (req.method === "POST" && url.pathname === "/v1/transfers") {
        const body = await readBody(req);
        ownedAccount(runtime, body.fromAccountId, claims.sub);
        const result = await runtime.transfer({
          fromAccountId:body.fromAccountId,
          toAccountId:body.toAccountId,
          amountMinor:body.amountMinor,
          idempotencyKey:body.idempotencyKey,
          reference:body.reference ?? "sandbox internal transfer",
        });
        return send(res, 200, {
          from:publicAccount(result.from),
          to:publicAccount(result.to, {includeCustomerId:false}),
        });
      }

      if (req.method === "POST" && url.pathname === "/v1/admin/fund-sandbox") {
        requireAdmin(claims, allowedAdminRoles);
        const body = await readBody(req);
        const account = await runtime.fundSandboxAccount({
          accountId:body.accountId,
          amountMinor:body.amountMinor,
          idempotencyKey:body.idempotencyKey,
        });
        return send(res, 200, {account:publicAccount(account)});
      }

      if (req.method === "POST" && url.pathname === "/v1/external-transfers") {
        return send(res, 501, {
          error:"external_rails_disabled",
          mode:runtime.mode,
        });
      }

      return send(res, 404, {error:"not_found"});
    } catch (error) {
      const status = errorStatus(error);
      return send(res, status, {
        error:status >= 500 ? "internal_error" : error.message,
      });
    }
  });
}
