(function install(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TasteExportUi = api;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createUiModel() {
  "use strict";

  function progressModel(count, expectedTotal) {
    if (!Number.isInteger(expectedTotal) || expectedTotal < 0) {
      return { mode: "indeterminate", percentage: null, ariaValue: null };
    }
    const percentage = expectedTotal === 0
      ? 100
      : Math.min(100, Math.round((count / expectedTotal) * 100));
    return { mode: "determinate", percentage, ariaValue: String(percentage) };
  }

  function primaryActionLabel(state, expectedTotal) {
    if (state === "running") return "Exporting…";
    if (state === "complete") return "Export again";
    if (Number.isInteger(expectedTotal) && expectedTotal >= 0) {
      return `Export ${expectedTotal.toLocaleString()} ${expectedTotal === 1 ? "rating" : "ratings"}`;
    }
    return "Export all ratings";
  }

  function popupState(pingReply) {
    if (pingReply?.ok === true && typeof pingReply.username === "string") {
      return {
        ready: true,
        message: `Ready to export @${pingReply.username}, newest first.`,
      };
    }
    return { ready: false, message: "Open any Taste.io user’s Ratings page first." };
  }

  return Object.freeze({ popupState, primaryActionLabel, progressModel });
});
