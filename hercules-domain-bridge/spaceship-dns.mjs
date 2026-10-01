const OWNED_DOMAIN = "sauceapproved.com";
const SPACESHIP_DNS_PATH = "/api/v1/dns/records/";

export function validateStudioDnsPlan({ domain, changes }) {
  if (domain !== OWNED_DOMAIN) {
    throw new Error("DNS bridge is restricted to sauceapproved.com");
  }

  for (const change of changes ?? []) {
    if (change.name === "@" || change.type === "NS") {
      throw new Error("Destructive apex or nameserver changes are blocked");
    }
    if (change.type !== "CNAME" || change.name !== "studio") {
      throw new Error("DNS bridge only permits the Studio CNAME");
    }
  }

  return true;
}

export function buildStudioDnsPlan({
  domain,
  studioHost = "studio",
  target,
  existingRecords = []
}) {
  if (domain !== OWNED_DOMAIN) {
    throw new Error("DNS bridge is restricted to sauceapproved.com");
  }
  if (studioHost !== "studio") {
    throw new Error("DNS bridge only permits the Studio hostname");
  }
  if (!target) throw new Error("Studio target is required");

  const desired = {
    type: "CNAME",
    name: studioHost,
    address: target,
    ttl: 3600
  };

  const current = existingRecords.find(
    (record) =>
      record.type === desired.type &&
      record.name === desired.name
  );

  const unchanged =
    current?.address === desired.address &&
    current?.ttl === desired.ttl;

  const plan = {
    action: unchanged ? "noop" : "upsert",
    domain,
    destructive: false,
    changes: unchanged ? [] : [desired]
  };

  validateStudioDnsPlan(plan);
  return plan;
}

export function buildSpaceshipUpsertRequest({
  domain,
  changes,
  force = false
}) {
  if (force) {
    throw new Error("Forced DNS writes are disabled");
  }

  validateStudioDnsPlan({ domain, changes });

  return {
    method: "PUT",
    path: `${SPACESHIP_DNS_PATH}${domain}`,
    body: {
      force: false,
      items: changes
    }
  };
}

export function assertBridgeCredentials(env = process.env) {
  if (!env.SPACESHIP_API_KEY || !env.SPACESHIP_API_SECRET) {
    throw new Error(
      "Spaceship API credentials are required; the bridge fails closed."
    );
  }
}
