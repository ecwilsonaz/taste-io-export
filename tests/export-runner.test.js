const test = require("node:test");
const assert = require("node:assert/strict");

const { collectAllRatings, fetchJsonWithRetry } = require("../lib/export-runner.js");

function response(status, body, retryAfter = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === "retry-after" ? retryAfter : null },
    json: async () => body,
  };
}

test("fetchJsonWithRetry honors Retry-After before retrying a throttled request", async () => {
  const replies = [response(429, null, "30"), response(200, { items: ["ok"] })];
  const sleeps = [];
  let requests = 0;

  const result = await fetchJsonWithRetry("/ratings", {
    fetchImpl: async () => {
      requests += 1;
      return replies.shift();
    },
    sleep: async (milliseconds) => sleeps.push(milliseconds),
  });

  assert.deepEqual(result, { items: ["ok"] });
  assert.equal(requests, 2);
  assert.deepEqual(sleeps, [30_000]);
});

test("fetchJsonWithRetry jitters exponential backoff when no server deadline exists", async () => {
  const replies = [response(503), response(200, { ok: true })];
  const sleeps = [];

  const result = await fetchJsonWithRetry("/ratings", {
    fetchImpl: async () => replies.shift(),
    random: () => 0,
    sleep: async (milliseconds) => sleeps.push(milliseconds),
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sleeps, [640]);
});

test("collectAllRatings continues after a short page until the endpoint returns empty", async () => {
  const offsets = [];
  const pages = new Map([
    [0, [{ slug: "a" }, { slug: "b" }]],
    [2, [{ slug: "c" }]],
    [3, []],
  ]);

  const items = await collectAllRatings({
    pageSize: 3,
    interPageDelayMs: 0,
    fetchPage: async ({ offset }) => {
      offsets.push(offset);
      return pages.get(offset);
    },
    extractItems: (payload) => payload,
    dedupeKey: (item) => item.slug,
  });

  assert.deepEqual(offsets, [0, 2, 3]);
  assert.deepEqual(items.map((item) => item.slug), ["a", "b", "c"]);
});

test("collectAllRatings rejects a partial export when Taste's count does not match", async () => {
  const pages = new Map([
    [0, [{ slug: "a" }, { slug: "b" }]],
    [2, []],
  ]);

  await assert.rejects(
    collectAllRatings({
      expectedTotal: 3,
      pageSize: 2,
      interPageDelayMs: 0,
      fetchPage: async ({ offset }) => pages.get(offset),
      extractItems: (payload) => payload,
      dedupeKey: (item) => item.slug,
    }),
    /reports 3 ratings, but the export found 2/i,
  );
});

test("collectAllRatings deduplicates rows and rejects a repeated non-advancing page", async () => {
  await assert.rejects(
    collectAllRatings({
      pageSize: 2,
      interPageDelayMs: 0,
      fetchPage: async () => [{ slug: "a" }, { slug: "b" }],
      extractItems: (payload) => payload,
      dedupeKey: (item) => item.slug,
    }),
    /pagination stopped advancing/i,
  );
});

test("collectAllRatings propagates cancellation during the inter-page wait", async () => {
  const controller = new AbortController();

  await assert.rejects(
    collectAllRatings({
      pageSize: 2,
      signal: controller.signal,
      fetchPage: async () => [{ slug: "a" }, { slug: "b" }],
      extractItems: (payload) => payload,
      dedupeKey: (item) => item.slug,
      sleep: async (_milliseconds, signal) => {
        controller.abort();
        throw new DOMException(signal.reason || "Export cancelled", "AbortError");
      },
    }),
    { name: "AbortError" },
  );
});

test("fetchJsonWithRetry does not retry permanent authentication failures", async () => {
  let requests = 0;
  await assert.rejects(
    fetchJsonWithRetry("/ratings", {
      fetchImpl: async () => {
        requests += 1;
        return response(401);
      },
      sleep: async () => assert.fail("should not sleep"),
    }),
    /sign in again/i,
  );
  assert.equal(requests, 1);
});
