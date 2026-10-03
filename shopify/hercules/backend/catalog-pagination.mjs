export class HerculesPaginationError extends Error {
  constructor(message) {
    super(message);
    this.name = "HerculesPaginationError";
  }
}

export async function collectConnection(fetchPage, options = {}) {
  if (typeof fetchPage !== "function") throw new TypeError("fetchPage must be a function");
  const pageSize = Math.min(Math.max(Number(options.pageSize ?? 50), 1), 250);
  const maxPages = Math.min(Math.max(Number(options.maxPages ?? 200), 1), 1000);
  const signal = options.signal;
  const items = [];
  const seenIds = new Set();
  let after = null;

  for (let page = 1; page <= maxPages; page += 1) {
    if (signal?.aborted) throw new DOMException("Catalog pagination aborted", "AbortError");

    const connection = await fetchPage({ first: pageSize, after, signal });
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo) {
      throw new HerculesPaginationError("Invalid Shopify connection response");
    }

    for (const node of connection.nodes) {
      if (!node || typeof node.id !== "string" || seenIds.has(node.id)) continue;
      seenIds.add(node.id);
      items.push(node);
    }

    if (!connection.pageInfo.hasNextPage) return items;
    const next = connection.pageInfo.endCursor;
    if (typeof next !== "string" || next.length === 0 || next === after) {
      throw new HerculesPaginationError("Unsafe Shopify pagination cursor");
    }
    after = next;
  }

  throw new HerculesPaginationError(`Catalog exceeded safety limit of ${maxPages} pages`);
}
