import {randomBytes} from "node:crypto";
import {resolve} from "node:path";
import {listenTrainingControlService} from "./service.mjs";

const root = resolve(process.env.HERCULES_TRAINING_ROOT ?? ".hercules-training");
const token = process.env.HERCULES_TRAINING_TOKEN ?? randomBytes(24).toString("hex");
const host = process.env.HERCULES_TRAINING_HOST ?? "127.0.0.1";
const port = Number(process.env.HERCULES_TRAINING_PORT ?? 38910);

listenTrainingControlService({root, token, host, port});

console.log(JSON.stringify({
  ok: true,
  service: "hercules-training-control",
  version: "0.1",
  root,
  host,
  port,
  tokenGenerated: !process.env.HERCULES_TRAINING_TOKEN,
  controlToken: !process.env.HERCULES_TRAINING_TOKEN ? token : undefined,
}, null, 2));
