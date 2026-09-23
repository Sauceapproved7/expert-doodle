import {randomBytes} from "node:crypto";
import {resolve} from "node:path";
import {listenForgeControlService} from "./control-api.mjs";
import {HttpForgeInterpreter} from "./interpreter.mjs";

const root = resolve(process.env.FORGE_ROOT ?? ".hercules-forge");
const token = process.env.FORGE_CONTROL_TOKEN ?? randomBytes(24).toString("hex");
const host = process.env.FORGE_HOST ?? "127.0.0.1";
const port = Number(process.env.FORGE_PORT ?? 38700);

const interpreter = process.env.FORGE_INTERPRETER_URL
  ? new HttpForgeInterpreter({
      endpoint: process.env.FORGE_INTERPRETER_URL,
      token: process.env.FORGE_INTERPRETER_TOKEN ?? null,
    })
  : null;

listenForgeControlService({root, token, interpreter, host, port});

console.log(JSON.stringify({
  ok: true,
  service: "hercules-forge-control-api",
  root,
  host,
  port,
  promptIngress: Boolean(interpreter),
  tokenGenerated: !process.env.FORGE_CONTROL_TOKEN,
  controlToken: !process.env.FORGE_CONTROL_TOKEN ? token : undefined,
}, null, 2));
