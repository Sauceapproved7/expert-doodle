import crypto from "node:crypto";

const MAGIC = {
  "4d5a": "PE",
  "7f454c46": "ELF",
  "cffaedfe": "Mach-O-64",
  "feedfacf": "Mach-O-64"
};

export function inspectBinary(input, options = {}) {
  if (!options.authorized) throw new Error("authorization_required");
  if (!Buffer.isBuffer(input)) throw new TypeError("binary_buffer_required");
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  if (input.length === 0) throw new Error("empty_binary");
  if (input.length > maxBytes) throw new Error("binary_too_large");

  const prefix = input.subarray(0, 4).toString("hex");
  const format = MAGIC[prefix.slice(0, 4)] ?? MAGIC[prefix] ?? "unknown";
  const strings = [...input.toString("latin1").matchAll(/[\x20-\x7e]{4,}/g)]
    .slice(0, options.maxStrings ?? 200)
    .map(m => ({ offset: m.index, value: m[0].slice(0, 512) }));

  return {
    schema: "hercules.binary-inspector.v1",
    evidence: {
      size: input.length,
      sha256: crypto.createHash("sha256").update(input).digest("hex"),
      format,
      strings
    },
    execution: "not_performed",
    mutations: "not_performed"
  };
}
