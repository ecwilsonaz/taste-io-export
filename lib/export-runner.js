(function install(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TasteExportRunner = api;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createRunner() {
  "use strict";

  async function abortableSleep(milliseconds, signal) {
    await new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("Export cancelled", "AbortError"));
        return;
      }
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new DOMException("Export cancelled", "AbortError"));
      };
      const timeout = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, milliseconds);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  function retryAfterMilliseconds(value, now = Date.now()) {
    if (!value) return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
    const deadline = Date.parse(value);
    if (!Number.isFinite(deadline)) return null;
    return Math.max(0, deadline - now);
  }

  function permanentError(message) {
    const error = new Error(message);
    error.retryable = false;
    return error;
  }

  function jitteredDelay(milliseconds, random = Math.random) {
    return Math.round(milliseconds * (0.8 + random() * 0.4));
  }

  async function fetchJsonWithRetry(url, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const sleep = options.sleep || abortableSleep;
    const retryDelays = options.retryDelays || [800, 1_600, 3_200];
    const now = options.now || Date.now;
    const random = options.random || Math.random;
    const signal = options.signal;
    let lastError;

    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      let retryAfter = null;
      try {
        const response = await fetchImpl(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
          signal,
        });
        if (response.ok) return await response.json();
        if (response.status === 401 || response.status === 403) {
          throw permanentError("Taste rejected the request. Sign in again, reload this page, and retry.");
        }
        if (response.status !== 429 && response.status < 500) {
          throw permanentError(`Taste returned HTTP ${response.status}.`);
        }
        if (response.status === 429) {
          retryAfter = retryAfterMilliseconds(response.headers?.get("Retry-After"), now());
        }
        lastError = new Error(`Taste is temporarily unavailable (HTTP ${response.status}).`);
      } catch (error) {
        if (error.name === "AbortError" || error.retryable === false) throw error;
        lastError = error;
      }

      if (attempt === retryDelays.length) break;
      await sleep(retryAfter ?? jitteredDelay(retryDelays[attempt], random), signal);
    }

    throw lastError || new Error("Could not reach Taste.io.");
  }

  async function collectAllRatings(options) {
    const pageSize = options.pageSize || 24;
    const maxPages = options.maxPages || 10_000;
    const interPageDelayMs = options.interPageDelayMs ?? 125;
    const expectedTotal = options.expectedTotal ?? null;
    const sleep = options.sleep || abortableSleep;
    const onProgress = options.onProgress || (() => {});
    const unique = new Map();
    let offset = 0;

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await options.fetchPage({ offset, limit: pageSize, signal: options.signal });
      const items = options.extractItems(payload);
      const previousCount = unique.size;

      for (const item of items) {
        const key = options.dedupeKey(item);
        if (!unique.has(key)) unique.set(key, item);
      }

      onProgress({ count: unique.size, expectedTotal });
      if (expectedTotal !== null && unique.size === expectedTotal) return [...unique.values()];
      if (expectedTotal !== null && unique.size > expectedTotal) {
        throw new Error(
          `Taste reports ${expectedTotal.toLocaleString()} ratings, but the export found ${unique.size.toLocaleString()}. No file was downloaded.`,
        );
      }
      if (items.length === 0) {
        if (expectedTotal !== null && unique.size !== expectedTotal) {
          throw new Error(
            `Taste reports ${expectedTotal.toLocaleString()} ratings, but the export found ${unique.size.toLocaleString()}. No file was downloaded.`,
          );
        }
        return [...unique.values()];
      }
      if (unique.size === previousCount) {
        throw new Error("Taste pagination stopped advancing; no file was downloaded.");
      }

      offset += items.length;
      if (interPageDelayMs) await sleep(interPageDelayMs, options.signal);
    }

    throw new Error("Stopped after an unexpectedly large number of pages.");
  }

  return Object.freeze({
    abortableSleep,
    collectAllRatings,
    fetchJsonWithRetry,
    jitteredDelay,
    retryAfterMilliseconds,
  });
});
