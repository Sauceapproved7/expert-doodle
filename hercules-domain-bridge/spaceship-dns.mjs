const OWNED_DOMAIN = "sauceapproved.com";

export function validateStudioDnsPlan({ domain, changes }) {
  if (domain !== OWNED_DOMAIN) {
    throw new Error("DNS bridge is restricted to sauceapproved.com");
  }

  for (const change of changes ?? []) {
    if (change.name === "@" || change.type === "NS") {
      throw new Error("Destructive apex or nameserver changes are blocked");
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

  return {
    action: unchanged ? "noop" : "upsert",
    domain,
    destructive: false,
    changes: unchanged ? [] : [desired]
  };
}

export function assertBridgeCredentials(env = process.env) {
  if (!env.SPACESHIP_API_KEY || !env.SPACESHIP_API_SECRET) {
    throw new Error(
      "Spaceship API credentials are required; the bridge fails closed."
    );
  }
}
