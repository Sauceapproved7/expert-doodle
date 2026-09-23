export const FORGE_SPEC_VERSION = "0.1";

const IDENT = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export function normalizeForgeSpec(input = {}) {
  return {
    version: input.version ?? FORGE_SPEC_VERSION,
    name: String(input.name ?? "").trim(),
    description: String(input.description ?? "").trim(),
    entities: Array.isArray(input.entities) ? input.entities : [],
    pages: Array.isArray(input.pages) ? input.pages : [],
    actions: Array.isArray(input.actions) ? input.actions : [],
  };
}

export function validateForgeSpec(input) {
  const spec = normalizeForgeSpec(input);
  const errors = [];

  if (spec.version !== FORGE_SPEC_VERSION) errors.push("unsupported spec version");
  if (!IDENT.test(spec.name)) errors.push("name must be a stable identifier");
  if (!spec.description) errors.push("description is required");

  const entityNames = new Set();
  for (const entity of spec.entities) {
    const name = String(entity?.name ?? "");
    if (!IDENT.test(name)) errors.push("invalid entity name: " + (name || "<empty>"));
    if (entityNames.has(name)) errors.push("duplicate entity: " + name);
    entityNames.add(name);

    if (!Array.isArray(entity?.fields) || entity.fields.length === 0) {
      errors.push("entity " + (name || "<empty>") + " must define fields");
      continue;
    }

    const fieldNames = new Set();
    for (const field of entity.fields) {
      const fieldName = String(field?.name ?? "");
      if (!IDENT.test(fieldName)) errors.push("invalid field name: " + name + "." + (fieldName || "<empty>"));
      if (fieldNames.has(fieldName)) errors.push("duplicate field: " + name + "." + fieldName);
      fieldNames.add(fieldName);
      if (!["string", "number", "boolean", "datetime", "json"].includes(field?.type)) {
        errors.push("unsupported field type: " + name + "." + fieldName);
      }
    }
  }

  for (const page of spec.pages) {
    const pageName = String(page?.name ?? "");
    if (!IDENT.test(pageName)) errors.push("invalid page name: " + (pageName || "<empty>"));
    if (!["list", "detail", "form", "dashboard"].includes(page?.kind)) {
      errors.push("unsupported page kind: " + (pageName || "<empty>"));
    }
    if (page?.entity && !entityNames.has(page.entity)) {
      errors.push("page " + pageName + " references unknown entity " + page.entity);
    }
  }

  for (const action of spec.actions) {
    const actionName = String(action?.name ?? "");
    if (!IDENT.test(actionName)) errors.push("invalid action name: " + (actionName || "<empty>"));
    if (!["create", "read", "update", "delete", "custom"].includes(action?.kind)) {
      errors.push("unsupported action kind: " + (actionName || "<empty>"));
    }
    if (action?.entity && !entityNames.has(action.entity)) {
      errors.push("action " + actionName + " references unknown entity " + action.entity);
    }
  }

  return {ok: errors.length === 0, errors, spec};
}
