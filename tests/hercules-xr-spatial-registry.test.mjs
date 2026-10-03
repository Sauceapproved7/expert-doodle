import test from "node:test";
import assert from "node:assert/strict";
import { SpatialRegistry } from "../sauceapproved-studio/xr/spatial-registry.mjs";

const anchor = {
  id: "anchor-1",
  sceneId: "scene-1",
  ownerId: "owner-1",
  pose: { position: [1, 2, 3], rotation: [0, 0, 0, 1] },
  payload: { kind: "product-preview", assetId: "hoodie-1" }
};

test("SpatialRegistry stores and reloads an authorized persistent anchor", () => {
  const registry = new SpatialRegistry();
  registry.put(anchor, { actorId: "owner-1", scopes: ["xr:write"] });
  assert.deepEqual(registry.get("anchor-1", { actorId: "owner-1", scopes: ["xr:read"] }), anchor);
});

test("SpatialRegistry fails closed when write scope is missing", () => {
  const registry = new SpatialRegistry();
  assert.throws(
    () => registry.put(anchor, { actorId: "owner-1", scopes: ["xr:read"] }),
    /xr:write/
  );
});

test("SpatialRegistry isolates anchors by owner", () => {
  const registry = new SpatialRegistry();
  registry.put(anchor, { actorId: "owner-1", scopes: ["xr:write"] });
  assert.equal(
    registry.get("anchor-1", { actorId: "owner-2", scopes: ["xr:read"] }),
    null
  );
});

test("SpatialRegistry rejects malformed spatial poses", () => {
  const registry = new SpatialRegistry();
  assert.throws(
    () => registry.put({ ...anchor, pose: { position: [1, 2], rotation: [0, 0, 0, 1] } }, { actorId: "owner-1", scopes: ["xr:write"] }),
    /position/
  );
});

test("SpatialRegistry exports a portable scene bundle without credentials", () => {
  const registry = new SpatialRegistry();
  registry.put(anchor, { actorId: "owner-1", scopes: ["xr:write"] });
  const bundle = registry.exportScene("scene-1", { actorId: "owner-1", scopes: ["xr:read"] });
  assert.equal(bundle.schema, "sauceapproved.hercules.xr.scene");
  assert.equal(bundle.anchors.length, 1);
  assert.equal(JSON.stringify(bundle).includes("token"), false);
  assert.equal(JSON.stringify(bundle).includes("credential"), false);
});
