"use strict";

(() => {
  if (document.querySelector("#taste-export-root")) return;

  const pathMatch = window.location.pathname.match(/^\/users\/([^/]+)\/ratings\/?$/);
  if (!pathMatch) return;

  const username = decodeURIComponent(pathMatch[1]);
  const core = globalThis.TasteExportCore;
  const runner = globalThis.TasteExportRunner;
  const ui = globalThis.TasteExportUi;
  const PAGE_SIZE = 24;
  let activeController = null;
  let panelState = "idle";
  let currentExpectedTotal = null;

  const root = document.createElement("div");
  root.id = "taste-export-root";
  root.innerHTML = `
    <button class="taste-export-launcher" type="button">Export ratings</button>
    <section class="taste-export-panel" aria-labelledby="taste-export-title" hidden>
      <div class="taste-export-header">
        <div>
          <p class="taste-export-eyebrow">Taste.io exporter</p>
          <h2 class="taste-export-title" id="taste-export-title">Export ratings</h2>
        </div>
        <button class="taste-export-close" type="button" aria-label="Close exporter">×</button>
      </div>
      <p class="taste-export-copy">@${escapeHtml(username)} · Movies and TV · newest first</p>
      <div class="taste-export-progress" role="progressbar" aria-label="Export progress" aria-valuemin="0" aria-valuemax="100" hidden>
        <div class="taste-export-progress-bar"></div>
      </div>
      <p class="taste-export-status" aria-live="polite" hidden></p>
      <div class="taste-export-actions">
        <button class="taste-export-primary" type="button">Export all ratings</button>
        <button class="taste-export-secondary" type="button" hidden>Cancel</button>
      </div>
      <p class="taste-export-note">Private — processed in this browser. Rating dates aren’t available.</p>
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
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden && !activeController) closePanel();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "TASTE_EXPORT_START") return false;
    openPanel();
    startExport();
    sendResponse({ ok: true });
    return false;
  });

  currentExpectedTotal = expectedRatingCount();
  setPrimaryState("idle", currentExpectedTotal);

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = value;
    return span.innerHTML;
  }

  function openPanel() {
    currentExpectedTotal = expectedRatingCount();
    if (panelState === "idle") setPrimaryState("idle", currentExpectedTotal);
    launcher.hidden = true;
    panel.hidden = false;
    exportButton.focus();
  }

  function closePanel() {
    if (activeController) return;
    panel.hidden = true;
    launcher.hidden = false;
    launcher.focus();
  }

  function setStatus(message, kind = "neutral") {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = !message;
  }

  function setPrimaryState(state, expectedTotal) {
    panelState = state;
    exportButton.dataset.state = state;
    exportButton.textContent = ui.primaryActionLabel(state, expectedTotal);
  }

  function hideProgress() {
    progress.hidden = true;
    progress.removeAttribute("aria-valuenow");
    delete progress.dataset.mode;
    progressBar.style.removeProperty("width");
  }

  function setProgress(count, expectedTotal) {
    const model = ui.progressModel(count, expectedTotal);
    progress.hidden = false;
    progress.dataset.mode = model.mode;
    if (model.mode === "determinate") {
      progressBar.style.width = `${model.percentage}%`;
      progress.setAttribute("aria-valuenow", model.ariaValue);
    } else {
      progressBar.style.removeProperty("width");
      progress.removeAttribute("aria-valuenow");
    }
  }

  function setRunning(running) {
    exportButton.disabled = running;
    cancelButton.hidden = !running;
    closeButton.disabled = running;
    if (running) cancelButton.focus();
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

  function ratingsEndpoint(offset, limit) {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return `/api/users/${encodeURIComponent(username)}/ratings?${query}`;
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
    currentExpectedTotal = expectedRatingCount();
    setPrimaryState("running", currentExpectedTotal);
    setRunning(true);
    setProgress(0, currentExpectedTotal);
    setStatus("Connecting to Taste.io…");

    try {
      const items = await runner.collectAllRatings({
        expectedTotal: currentExpectedTotal,
        pageSize: PAGE_SIZE,
        signal: activeController.signal,
        fetchPage: ({ offset, limit, signal }) => runner.fetchJsonWithRetry(
          ratingsEndpoint(offset, limit),
          { signal },
        ),
        extractItems: core.extractItems,
        dedupeKey: core.dedupeKey,
        onProgress: ({ count, expectedTotal }) => {
          setProgress(count, expectedTotal);
          setStatus(
            expectedTotal === null
              ? `Collected ${count.toLocaleString()} ratings…`
              : `Collected ${count.toLocaleString()} of ${expectedTotal.toLocaleString()} ratings…`,
          );
        },
      });

      downloadCsv(items);
      hideProgress();
      setPrimaryState("complete", items.length);
      setStatus(`✓ ${items.length.toLocaleString()} ratings downloaded.`, "success");
    } catch (error) {
      hideProgress();
      setPrimaryState("idle", expectedRatingCount());
      if (error.name === "AbortError") {
        setStatus("Export cancelled.");
      } else {
        console.error("Taste.io ratings export failed", error);
        setStatus(error.message || "The export failed. Please retry.", "error");
      }
    } finally {
      activeController = null;
      setRunning(false);
      exportButton.focus();
    }
  }
})();
