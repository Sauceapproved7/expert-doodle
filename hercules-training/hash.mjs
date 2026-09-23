import {createHash} from "node:crypto";

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
}

export function sha256Object(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isGitSha(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}
