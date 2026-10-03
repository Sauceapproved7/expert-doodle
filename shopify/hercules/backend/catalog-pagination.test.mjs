import test from "node:test";
import assert from "node:assert/strict";
import { collectConnection, HerculesPaginationError } from "./catalog-pagination.mjs";

test("collects every product page beyond the first 50", async () => {
  const pages = [
    { nodes: Array.from({ length: 50 }, (_, i) => ({ id: `p-${i+1}` })), pageInfo: { hasNextPage: true, endCursor: "c1" } },
    { nodes: Array.from({ length: 50 }, (_, i) => ({ id: `p-${i+51}` })), pageInfo: { hasNextPage: true, endCursor: "c2" } },
    { nodes: Array.from({ length: 23 }, (_, i) => ({ id: `p-${i+101}` })), pageInfo: { hasNextPage: false, endCursor: null } }
  ];
  const seen = [];
  const result = await collectConnection(async ({ after }) => {
    seen.push(after);
    return pages[seen.length - 1];
  }, { pageSize: 50 });
  assert.equal(result.length, 123);
  assert.deepEqual(seen, [null, "c1", "c2"]);
});

test("deduplicates product ids across pages", async () => {
  let call = 0;
  const result = await collectConnection(async () => {
    call += 1;
    return call === 1
      ? { nodes: [{ id: "p-1" }, { id: "p-2" }], pageInfo: { hasNextPage: true, endCursor: "next" } }
      : { nodes: [{ id: "p-2" }, { id: "p-3" }], pageInfo: { hasNextPage: false, endCursor: null } };
  });
  assert.deepEqual(result.map(x => x.id), ["p-1", "p-2", "p-3"]);
});

test("fails closed when Shopify claims another page without a cursor", async () => {
  await assert.rejects(
    collectConnection(async () => ({ nodes: [], pageInfo: { hasNextPage: true, endCursor: null } })),
    HerculesPaginationError
  );
});

test("aborts at configured safety page limit", async () => {
  await assert.rejects(
    collectConnection(async () => ({ nodes: [], pageInfo: { hasNextPage: true, endCursor: "same" } }), { maxPages: 2 }),
    HerculesPaginationError
  );
});
