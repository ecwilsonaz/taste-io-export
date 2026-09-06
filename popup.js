"use strict";

const exportButton = document.querySelector("#export");
const message = document.querySelector("#message");
const openTaste = document.querySelector("#open-taste");
const { popupState } = globalThis.TasteExportUi;

async function pingRatingsPage(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "TASTE_EXPORT_PING" });
  } catch {
    return undefined;
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
  // No permissions are declared, so tab.url is unavailable. The content script
  // only exists on ratings pages, so a reply to the ping proves we are on one.
  const state = popupState(tab?.id ? await pingRatingsPage(tab.id) : undefined);
  message.textContent = state.message;
  if (!state.ready) return;

  exportButton.disabled = false;
  openTaste.hidden = true;
  message.dataset.ready = "true";
  exportButton.focus();

  exportButton.addEventListener("click", async () => {
    exportButton.disabled = true;
    message.textContent = "Starting the export in the Taste.io page…";
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "TASTE_EXPORT_START" });
      window.close();
    } catch {
      message.textContent = "Reload the Taste.io ratings page, then try again.";
      exportButton.disabled = false;
    }
  });
});
