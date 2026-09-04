"use strict";

(() => {
  if (document.querySelector("#taste-export-root")) return;

  const pathMatch = window.location.pathname.match(/^\/users\/([^/]+)\/ratings\/?$/);
  if (!pathMatch) return;

  const username = decodeURIComponent(pathMatch[1]);
  const core = globalThis.TasteExportCore;
  const PAGE_SIZE = 24;
  const MAX_PAGES = 10_000;
  let activeController = null;

  const root = document.createElement("div");
  root.id = "taste-export-root";
  root.innerHTML = `
    <button class="taste-export-launcher" type="button">Export ratings</button>
    <section class="taste-export-panel" aria-label="Taste.io ratings exporter" hidden>
      <div class="taste-export-header">
        <div>
          <p class="taste-export-eyebrow">Taste.io exporter</p>
          <h2 class="taste-export-title">Download every rating</h2>
        </div>
        <button class="taste-export-close" type="button" aria-label="Close exporter">×</button>
      </div>
      <p class="taste-export-copy">Exports movies and TV shows for @${escapeHtml(username)}, newest first.</p>
      <div class="taste-export-progress" role="progressbar" aria-label="Export progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>
        <div class="taste-export-progress-bar"></div>
      </div>
      <p class="taste-export-status" aria-live="polite">Ready to export.</p>
      <div class="taste-export-actions">
        <button class="taste-export-primary" type="button">Export all ratings</button>
        <button class="taste-export-secondary" type="button" hidden>Cancel</button>
      </div>
      <p class="taste-export-note">Nothing is uploaded. Taste provides rating order, but not rating dates, so <code>rated_at</code> is blank.</p>
    </section>
  `;
  document.body.append(root);

  const launcher = root.querySelector(".taste-export-launcher");
  const panel = root.querySelector(".taste-export-panel");
  const closeButton = root.querySelector(".taste-export-close");
  const exportButton = root.querySelector(".taste-export-primary");
  const cancelButton = root.querySelector(".taste-export-secondary");
  const status = root.querySelector(".taste-export-status");
  const progress = root.querySelector(".taste-export-progress");
  const progressBar = root.querySelector(".taste-export-progress-bar");

  launcher.addEventListener("click", openPanel);
  closeButton.addEventListener("click", closePanel);
  exportButton.addEventListener("click", startExport);
  cancelButton.addEventListener("click", () => activeController?.abort());

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "TASTE_EXPORT_START") return false;
    openPanel();
    startExport();
    sendResponse({ ok: true });
    return false;
  });

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = value;
    return span.innerHTML;
  }

  function openPanel() {
    launcher.hidden = true;
    panel.hidden = false;
  }

  function closePanel() {
    if (activeController) return;
    panel.hidden = true;
    launcher.hidden = false;
  }

  function setStatus(message, kind = "neutral") {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function setProgress(count, expectedTotal) {
    progress.hidden = false;
    const percentage = expectedTotal
      ? Math.min(100, Math.round((count / expectedTotal) * 100))
      : Math.min(95, 12 + (count % (PAGE_SIZE * 7)) / (PAGE_SIZE * 7) * 83);
    progressBar.style.width = `${percentage}%`;
    progress.setAttribute("aria-valuenow", String(Math.round(percentage)));
  }

  function setRunning(running) {
    exportButton.disabled = running;
    exportButton.textContent = running ? "Exporting…" : "Export all ratings";
    cancelButton.hidden = !running;
    closeButton.disabled = running;
  }

  function expectedRatingCount() {
    const script = document.querySelector("#__NEXT_DATA__");
    if (!script?.textContent) return null;
    try {
      const pageProps = JSON.parse(script.textContent)?.props?.pageProps;
      const ratings = pageProps?.user?.ratings;
      const candidates = [ratings, ratings?.total, ratings?.count, pageProps?.total];
      const count = candidates.find((value) => Number.isInteger(value) && value >= 0);
      return count ?? null;
    } catch {
      return null;
    }
  }

  async function sleep(milliseconds, signal) {
    await new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Export cancelled", "AbortError"));
        return;
      }
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new DOMException("Export cancelled", "AbortError"));
      };
      const timeout = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, milliseconds);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  async function fetchJsonWithRetry(url, signal) {
    const retryDelays = [0, 800, 1_600, 3_200];
    let lastError;

    for (const delay of retryDelays) {
      if (delay) await sleep(delay, signal);
      try {
        const response = await fetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
          signal,
        });
        if (response.ok) return await response.json();
        if (response.status === 401 || response.status === 403) {
          throw new Error("Taste rejected the request. Sign in again, reload this page, and retry.");
        }
        if (response.status !== 429 && response.status < 500) {
          throw new Error(`Taste returned HTTP ${response.status}.`);
        }
        lastError = new Error(`Taste is temporarily unavailable (HTTP ${response.status}).`);
      } catch (error) {
        if (error.name === "AbortError") throw error;
        if (/Sign in again|HTTP 4\d\d/.test(error.message)) throw error;
        lastError = error;
      }
    }

    throw lastError || new Error("Could not reach Taste.io.");
  }

  async function collectRatings(signal, expectedTotal) {
    const unique = new Map();
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const endpoint = `/api/users/${encodeURIComponent(username)}/ratings?${query}`;
      const payload = await fetchJsonWithRetry(endpoint, signal);
      const items = core.extractItems(payload);

      for (const item of items) {
        const key = core.dedupeKey(item);
        if (!unique.has(key)) unique.set(key, item);
      }

      setProgress(unique.size, expectedTotal);
      setStatus(
        expectedTotal
          ? `Collected ${unique.size.toLocaleString()} of ${expectedTotal.toLocaleString()} ratings…`
          : `Collected ${unique.size.toLocaleString()} ratings…`,
      );

      if (items.length < PAGE_SIZE) return [...unique.values()];
      offset += items.length;
      await sleep(125, signal);
    }

    throw new Error("Stopped after an unexpectedly large number of pages.");
  }

  function downloadCsv(items) {
    const exportedAt = new Date().toISOString();
    const rows = items.map((item, index) => core.normalizeRating(item, index + 1, exportedAt));
    const blob = new Blob([core.csvFromRatings(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = core.filenameFor(username);
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function startExport() {
    if (activeController) return;
    activeController = new AbortController();
    const expectedTotal = expectedRatingCount();
    setRunning(true);
    setProgress(0, expectedTotal);
    setStatus("Connecting to Taste.io…");

    try {
      const items = await collectRatings(activeController.signal, expectedTotal);
      if (expectedTotal !== null && items.length !== expectedTotal) {
        throw new Error(
          `Taste reports ${expectedTotal.toLocaleString()} ratings, but the export found ${items.length.toLocaleString()}. ` +
          "No file was downloaded; avoid rating anything during export and retry.",
        );
      }
      downloadCsv(items);
      setProgress(items.length, items.length || 1);
      setStatus(`Downloaded ${items.length.toLocaleString()} ratings.`, "success");
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("Export cancelled.");
      } else {
        console.error("Taste.io ratings export failed", error);
        setStatus(error.message || "The export failed. Please retry.", "error");
      }
    } finally {
      activeController = null;
      setRunning(false);
    }
  }
})();
