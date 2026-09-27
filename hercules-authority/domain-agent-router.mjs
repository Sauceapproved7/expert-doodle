import {HerculesEmbeddedAgentRouter} from "../hercules-models/embedded-agent-router.mjs";

const MAX_ROUTING_TEXT = 32 * 1024;

function routingText(input) {
  let text;
  if (typeof input === "string") text = input;
  else if (input && typeof input.text === "string") text = input.text;
  else text = JSON.stringify(input ?? "");

  text = String(text).trim();
  if (!text) throw new TypeError("domain agent routing input is required");
  if (Buffer.byteLength(text, "utf8") > MAX_ROUTING_TEXT) {
    throw new TypeError("domain agent routing input is too large");
  }
  return text;
}

export function createHerculesRouteTask({router}) {
  if (!router || typeof router.infer !== "function") {
    throw new TypeError("Hercules agent router with infer() is required");
  }

  return async function routeDomainAgentTask(context = {}) {
    const output = await router.infer(routingText(context.input));
    return Object.freeze({
      modelId: output.modelId,
      checkpoint: output.checkpoint ?? null,
      route: output.route,
      scores: output.scores ?? null,
    });
  };
}

export async function loadHerculesRouteTask(options = {}) {
  const router = await HerculesEmbeddedAgentRouter.load(options);
  return createHerculesRouteTask({router});
}
