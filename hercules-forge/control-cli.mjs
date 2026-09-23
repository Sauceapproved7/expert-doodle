import {randomBytes} from "node:crypto";
import {resolve} from "node:path";
import {listenForgeControlService} from "./control-api.mjs";

const root = resolve(process.env.FORGE_ROOT ?? ".hercules-forge");
const token = process.env.FORGE_CONTROL_TOKEN ?? randomBytes(24).toString("hex");
const host = process.env.FORGE_HOST ?? "127.0.0.1";
const port = Number(process.env.FORGE_PORT ?? 38700);

listenForgeControlService({root, token, host, port});

console.log(JSON.stringify({
  ok: true,
  service: "hercules-forge-control-api",
  root,
  host,
  port,
  tokenGenerated: !process.env.FORGE_CONTROL_TOKEN,
  controlToken: !process.env.FORGE_CONTROL_TOKEN ? token : undefined,
}, null, 2));
