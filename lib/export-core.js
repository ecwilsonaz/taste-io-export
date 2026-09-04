(function install(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.TasteExportCore = api;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createCore() {
  "use strict";

  const CSV_COLUMNS = [
    "taste_order",
    "title",
    "year",
    "type",
    "rating",
    "rating_label",
    "taste_slug",
    "taste_url",
    "runtime_minutes",
    "genres",
    "rated_at",
    "exported_at",
  ];

  const RATING_LABELS = Object.freeze({
    1: "Awful",
    2: "Meh",
    3: "Good",
    4: "Amazing",
  });

  function extractItems(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload && payload.items)) return payload.items;
    if (Array.isArray(payload && payload.data && payload.data.items)) {
      return payload.data.items;
    }
    throw new Error("Taste returned an unrecognized ratings response format.");
  }

  function ratingLabel(value) {
    return RATING_LABELS[Number(value)] || "Unknown";
  }

  function isTvCategory(category) {
    return String(category || "").toLowerCase().includes("tv");
  }

  function genreNames(item) {
    const value = item.genre ?? item.genres ?? [];
    const entries = Array.isArray(value) ? value : [value];
    return entries
      .map((entry) => {
        if (typeof entry === "string") return entry;
        return entry && (entry.name || entry.label || entry.slug);
      })
      .filter(Boolean)
      .join("; ");
  }

  function normalizeRating(item, order, exportedAt) {
    const tv = isTvCategory(item.category);
    const rating = item.user?.rating ?? item.rating ?? item.highlightRating ?? "";
    const slug = String(item.slug || "");

    return {
      taste_order: order,
      title: item.name ?? item.title ?? "",
      year: item.year ?? item.releaseYear ?? "",
      type: tv ? "TV Show" : "Movie",
      rating,
      rating_label: rating === "" ? "Unknown" : ratingLabel(rating),
      taste_slug: slug,
      taste_url: slug
        ? `https://www.taste.io/${tv ? "tv" : "movies"}/${encodeURIComponent(slug)}`
        : "",
      runtime_minutes: item.runtime ?? item.runtimeMinutes ?? "",
      genres: genreNames(item),
      // Taste's ratings endpoint exposes newest-first order, but not calendar dates.
      rated_at: "",
      exported_at: exportedAt,
    };
  }

  function protectSpreadsheetFormula(value) {
    const text = String(value ?? "");
    return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  }

  function csvCell(value) {
    const text = protectSpreadsheetFormula(value).replaceAll('"', '""');
    return /[",\r\n]/.test(text) ? `"${text}"` : text;
  }

  function csvFromRatings(rows) {
    const lines = [CSV_COLUMNS.join(",")];
    for (const row of rows) {
      lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(","));
    }
    return `\uFEFF${lines.join("\r\n")}\r\n`;
  }

  function filenameFor(username, date = new Date()) {
    const safeUser = String(username || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "user";
    return `taste-ratings-${safeUser}-${date.toISOString().slice(0, 10)}.csv`;
  }

  function dedupeKey(item) {
    return `${String(item.category || "unknown").toLowerCase()}:${String(item.slug || item.name || "")}`;
  }

  return Object.freeze({
    CSV_COLUMNS,
    csvFromRatings,
    dedupeKey,
    extractItems,
    filenameFor,
    normalizeRating,
    ratingLabel,
  });
});
