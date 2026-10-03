import test from "node:test";
import assert from "node:assert/strict";
import { SpatialRegistry } from "../sauceapproved-studio/xr/spatial-registry.mjs";
import { XRSceneEngine } from "../sauceapproved-studio/xr/scene-engine.mjs";

const owner = { actorId: "owner-1", scopes: ["xr:read", "xr:write", "xr:session"] };

test("scene engine composes a deterministic frame from authorized anchors", () => {
  const registry = new SpatialRegistry();
  registry.put({ id:"b", sceneId:"scene-1", ownerId:"owner-1", pose:{position:[2,0,0],rotation:[0,0,0,1]}, payload:{kind:"label"} }, owner);
  registry.put({ id:"a", sceneId:"scene-1", ownerId:"owner-1", pose:{position:[1,0,0],rotation:[0,0,0,1]}, payload:{kind:"product"} }, owner);
  const engine = new XRSceneEngine({ registry });
  const frame = engine.compose("scene-1", owner);
  assert.deepEqual(frame.nodes.map((node) => node.id), ["a", "b"]);
  assert.equal(frame.schema, "sauceapproved.hercules.xr.frame");
});

test("client session requires explicit xr:session scope", () => {
  const engine = new XRSceneEngine({ registry: new SpatialRegistry() });
  assert.throws(() => engine.openSession("scene-1", { actorId:"owner-1", scopes:["xr:read"] }), /xr:session/);
});

test("client session exposes capabilities without granting new authority", () => {
  const engine = new XRSceneEngine({ registry: new SpatialRegistry() });
  const session = engine.openSession("scene-1", owner, { renderer:"webxr", capabilities:["hit-test","anchors"] });
  assert.equal(session.actorId, "owner-1");
  assert.deepEqual(session.capabilities, ["anchors","hit-test"]);
  assert.equal("token" in session, false);
  assert.equal("credential" in session, false);
});

test("interaction intent is data until an allowlisted handler executes it", () => {
  const engine = new XRSceneEngine({ registry: new SpatialRegistry(), handlers: {
    select: ({ nodeId }) => ({ accepted:true, nodeId })
  }});
  assert.deepEqual(engine.dispatch({ type:"select", nodeId:"node-1" }, owner), { accepted:true, nodeId:"node-1" });
  assert.throws(() => engine.dispatch({ type:"purchase", nodeId:"node-1" }, owner), /not allowlisted/);
});
