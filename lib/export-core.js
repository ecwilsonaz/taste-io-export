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
    "taste_rating",
    "taste_rating_label",
    "taste_slug",
    "taste_url",
    "runtime_minutes",
    "genres",
    "directors",
    "cast",
    "imdb_rating",
    "imdb_rating_count",
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

  function mediaType(category) {
    const normalized = String(category || "").toLowerCase().replaceAll("-", "_");
    if (normalized === "movie" || normalized === "movies") {
      return { label: "Movie", path: "movies" };
    }
    if (["tv", "tv_show", "tv_shows", "tvshow", "tvshows"].includes(normalized)) {
      return { label: "TV Show", path: "tv" };
    }
    throw new Error(`Taste returned an unknown media category: ${category || "(missing)"}.`);
  }

  function ratingIdentity(item) {
    const type = mediaType(item.category);
    const slug = String(item.slug || "");
    if (!slug) throw new Error("Taste returned a rating without a stable slug.");
    return {
      type,
      slug,
      key: `${type.path}:${slug}`,
      url: `https://www.taste.io/${type.path}/${encodeURIComponent(slug)}`,
    };
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

  function names(value) {
    const entries = Array.isArray(value) ? value : value ? [value] : [];
    return entries
      .map((entry) => {
        if (typeof entry === "string") return entry;
        return entry && (entry.name || entry.fullName || entry.label);
      })
      .filter(Boolean)
      .join("; ");
  }

  function numericValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    const exact = value.trim().replaceAll(",", "");
    const match = exact.match(/^-?\d+(?:\.\d+)?$/);
    if (!match) return null;
    return Number(exact);
  }

  function releaseYear(item) {
    const value = item.year ?? item.releaseYear;
    const match = String(value ?? "").match(/^(\d{4})(?:\D|$)/);
    const year = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(year) || year < 1870 || year > 2200) {
      throw new Error(`Taste returned an invalid release year for ${item.slug || "a rating"}.`);
    }
    return year;
  }

  /**
   * Taste's ratings payload nests its displayed IMDb aggregate at `external.imdb`, with
   * `ratingAverage` and `ratingTotal` values. Fail blank on any other shape: false identity
   * evidence is worse than missing evidence, and Taste's own ratings must never leak in here.
   */
  function imdbEvidence(item) {
    const imdb = item.external?.imdb;
    if (!imdb || typeof imdb !== "object" || Array.isArray(imdb)) {
      return { rating: "", count: "" };
    }
    const rating = numericValue(imdb.ratingAverage);
    const count = numericValue(imdb.ratingTotal);
    return {
      rating: rating !== null && rating >= 0 && rating <= 10 ? rating : "",
      count: count !== null && Number.isInteger(count) && count >= 0 ? count : "",
    };
  }

  function normalizeRating(item, order, exportedAt) {
    const identity = ratingIdentity(item);
    // highlightRating belongs to the profile whose list is being exported.
    // item.user.rating may instead describe the signed-in viewer on public profiles.
    const rating = item.highlightRating ?? item.user?.rating ?? "";
    const imdb = imdbEvidence(item);
    const title = String(item.name ?? item.title ?? "").trim();
    if (!title) throw new Error(`Taste returned a rating without a title for ${identity.slug}.`);
    const year = releaseYear(item);
    if (!Number.isInteger(Number(rating)) || !RATING_LABELS[Number(rating)]) {
      throw new Error(`Taste returned an invalid rating for ${identity.slug}.`);
    }

    return {
      taste_order: order,
      title,
      year,
      type: identity.type.label,
      taste_rating: Number(rating),
      taste_rating_label: ratingLabel(rating),
      taste_slug: identity.slug,
      taste_url: identity.url,
      runtime_minutes: item.runtime ?? item.runtimeMinutes ?? "",
      genres: genreNames(item),
      directors: names(item.directors ?? item.director),
      cast: names(item.cast ?? item.actors ?? item.starring),
      imdb_rating: imdb.rating,
      imdb_rating_count: imdb.count,
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
    return ratingIdentity(item).key;
  }

  return Object.freeze({
    CSV_COLUMNS,
    csvFromRatings,
    dedupeKey,
    extractItems,
    filenameFor,
    imdbEvidence,
    normalizeRating,
    ratingLabel,
  });
});
