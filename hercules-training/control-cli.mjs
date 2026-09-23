import {randomBytes} from "node:crypto";
import {resolve} from "node:path";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {HttpTrainingRunner} from "./runner.mjs";
import {listenTrainingControlService} from "./service.mjs";

const root = resolve(process.env.HERCULES_TRAINING_ROOT ?? ".hercules-training");
const token = process.env.HERCULES_TRAINING_TOKEN ?? randomBytes(24).toString("hex");
const host = process.env.HERCULES_TRAINING_HOST ?? "127.0.0.1";
const port = Number(process.env.HERCULES_TRAINING_PORT ?? 38910);

const runner = process.env.HERCULES_TRAINING_RUNNER_URL
  ? new HttpTrainingRunner({
      endpoint: process.env.HERCULES_TRAINING_RUNNER_URL,
      token: process.env.HERCULES_TRAINING_RUNNER_TOKEN ?? null,
    })
  : null;

listenTrainingControlService({
  root,
  token,
  models: HERCULES_MODEL_SLOTS,
  runner,
  host,
  port,
});

console.log(JSON.stringify({
  ok: true,
  service: "hercules-training-control",
  version: "0.1",
  root,
  host,
  port,
  models: HERCULES_MODEL_SLOTS.length,
  runnerConfigured: Boolean(runner),
  tokenGenerated: !process.env.HERCULES_TRAINING_TOKEN,
  controlToken: !process.env.HERCULES_TRAINING_TOKEN ? token : undefined,
}, null, 2));
