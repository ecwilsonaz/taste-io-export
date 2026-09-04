"use strict";

const exportButton = document.querySelector("#export");
const message = document.querySelector("#message");
const openTaste = document.querySelector("#open-taste");

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const isRatingsPage = /^https:\/\/www\.taste\.io\/users\/[^/]+\/ratings(?:[/?#]|$)/.test(
    tab?.url || "",
  );

  if (!isRatingsPage || !tab?.id) {
    message.textContent = "Open any Taste.io user’s Ratings page first.";
    return;
  }

  exportButton.disabled = false;
  openTaste.hidden = true;
  message.textContent = "Ready to export every movie and TV rating, newest first.";

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
