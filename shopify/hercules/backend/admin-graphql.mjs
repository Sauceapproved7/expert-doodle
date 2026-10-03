function normalizeShop(shop) {
  const value = String(shop || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) throw new Error("invalid_shop_domain");
  return value;
}

function normalizeVersion(version) {
  const value = String(version || "").trim();
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error("api_version_required");
  return value;
}

export function buildAdminGraphqlEndpoint(shop, apiVersion) {
  return `https://${normalizeShop(shop)}/admin/api/${normalizeVersion(apiVersion)}/graphql.json`;
}
