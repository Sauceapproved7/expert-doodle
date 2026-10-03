const FORWARDING_HEADERS = [
  "forwarded",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-forwarded-prefix",
];

function hasUntrustedForwardingContext(request) {
  return FORWARDING_HEADERS.some((name) => request.headers.has(name));
}

export function canonicalExternalRequest(request) {
  if (!(request instanceof Request)) throw new Error("INVALID_REQUEST");

  if (hasUntrustedForwardingContext(request)) {
    throw new Error("UNTRUSTED_FORWARDING_CONTEXT");
  }

  const url = new URL(request.url);
  url.search = "";
  url.hash = "";

  if (url.username || url.password) {
    throw new Error("INVALID_EXTERNAL_URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("EXTERNAL_HTTPS_REQUIRED");
  }

  return {
    method: request.method.toUpperCase(),
    uri: url.toString(),
  };
}
