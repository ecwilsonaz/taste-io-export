const test = require("node:test");
const assert = require("node:assert/strict");

const {
  csvFromRatings,
  extractItems,
  filenameFor,
  normalizeRating,
  ratingLabel,
} = require("../lib/export-core.js");

test("extractItems accepts the response shapes Taste has used", () => {
  const items = [{ slug: "moon-2009" }];

  assert.deepEqual(extractItems(items), items);
  assert.deepEqual(extractItems({ items }), items);
  assert.deepEqual(extractItems({ data: { items } }), items);
  assert.throws(() => extractItems({ result: items }), /response format/i);
});

test("normalizeRating keeps the user's rating and stable Taste order", () => {
  const row = normalizeRating(
    {
      category: "movies",
      slug: "moon-2009-BJpegguQ2QM",
      name: "Moon",
      year: 2009,
      runtime: 97,
      genre: ["Science Fiction", "Drama"],
      user: { rating: 3 },
      highlightRating: 3,
    },
    7,
    "2026-09-04T20:00:00.000Z",
  );

  assert.deepEqual(row, {
    taste_order: 7,
    title: "Moon",
    year: 2009,
    type: "Movie",
    rating: 3,
    rating_label: "Good",
    taste_slug: "moon-2009-BJpegguQ2QM",
    taste_url: "https://www.taste.io/movies/moon-2009-BJpegguQ2QM",
    runtime_minutes: 97,
    genres: "Science Fiction; Drama",
    rated_at: "",
    exported_at: "2026-09-04T20:00:00.000Z",
  });
});

test("normalizeRating tolerates alternate fields and TV categories", () => {
  const row = normalizeRating(
    {
      category: "tv_shows",
      slug: "severance",
      title: "Severance",
      releaseYear: "2022",
      genres: "Drama",
      rating: 4,
    },
    1,
    "now",
  );

  assert.equal(row.title, "Severance");
  assert.equal(row.year, "2022");
  assert.equal(row.type, "TV Show");
  assert.equal(row.rating, 4);
  assert.equal(row.rating_label, "Amazing");
  assert.equal(row.taste_url, "https://www.taste.io/tv/severance");
});

test("rating labels match Taste's numeric scale", () => {
  assert.equal(ratingLabel(1), "Awful");
  assert.equal(ratingLabel(2), "Meh");
  assert.equal(ratingLabel(3), "Good");
  assert.equal(ratingLabel(4), "Amazing");
  assert.equal(ratingLabel(9), "Unknown");
});

test("CSV quotes commas and formula-like cells and includes a UTF-8 BOM", () => {
  const csv = csvFromRatings([
    {
      taste_order: 1,
      title: '=HYPERLINK("bad")',
      year: 2020,
      type: "Movie",
      rating: 2,
      rating_label: "Meh",
      taste_slug: "odd",
      taste_url: "https://www.taste.io/movies/odd",
      runtime_minutes: "",
      genres: "Comedy, Drama",
      rated_at: "",
      exported_at: "now",
    },
  ]);

  assert.ok(csv.startsWith("\uFEFFtaste_order,title,year"));
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Comedy, Drama"/);
});

test("filename is safe and date-stamped", () => {
  assert.equal(
    filenameFor("Eric Wilson/../", new Date("2026-09-04T20:00:00Z")),
    "taste-ratings-eric-wilson-2026-09-04.csv",
  );
});
