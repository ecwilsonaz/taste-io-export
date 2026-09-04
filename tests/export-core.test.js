const test = require("node:test");
const assert = require("node:assert/strict");

const {
  csvFromRatings,
  extractItems,
  filenameFor,
  imdbEvidence,
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
      directors: [{ name: "Duncan Jones" }],
      cast: ["Sam Rockwell", { name: "Kevin Spacey" }],
      external: { imdb: { ratingAverage: 7.8, ratingTotal: "381,245" } },
      user: { rating: 1 },
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
    taste_rating: 3,
    taste_rating_label: "Good",
    taste_slug: "moon-2009-BJpegguQ2QM",
    taste_url: "https://www.taste.io/movies/moon-2009-BJpegguQ2QM",
    runtime_minutes: 97,
    genres: "Science Fiction; Drama",
    directors: "Duncan Jones",
    cast: "Sam Rockwell; Kevin Spacey",
    imdb_rating: 7.8,
    imdb_rating_count: 381245,
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
      highlightRating: 4,
    },
    1,
    "now",
  );

  assert.equal(row.title, "Severance");
  assert.equal(row.year, 2022);
  assert.equal(row.type, "TV Show");
  assert.equal(row.taste_rating, 4);
  assert.equal(row.taste_rating_label, "Amazing");
  assert.equal(row.taste_url, "https://www.taste.io/tv/severance");
});

test("rating labels match Taste's numeric scale", () => {
  assert.equal(ratingLabel(1), "Awful");
  assert.equal(ratingLabel(2), "Meh");
  assert.equal(ratingLabel(3), "Good");
  assert.equal(ratingLabel(4), "Amazing");
  assert.equal(ratingLabel(9), "Unknown");
});

test("unknown categories, ratings, and identities fail closed", () => {
  assert.throws(
    () => normalizeRating({ category: "podcast", slug: "serial", highlightRating: 4 }, 1, "now"),
    /unknown media category/i,
  );
  assert.throws(
    () => normalizeRating({ category: "movies", slug: "moon", name: "Moon", year: 2009, highlightRating: 8 }, 1, "now"),
    /invalid rating/i,
  );
  assert.throws(
    () => normalizeRating({ category: "movies", highlightRating: 3 }, 1, "now"),
    /stable slug/i,
  );
  assert.throws(
    () => normalizeRating({ category: "movies", slug: "untitled", year: 2020, highlightRating: 3 }, 1, "now"),
    /without a title/i,
  );
  assert.throws(
    () => normalizeRating({ category: "movies", slug: "dateless", name: "Dateless", highlightRating: 3 }, 1, "now"),
    /invalid release year/i,
  );
});

test("IMDb evidence accepts only Taste's observed external.imdb shape", () => {
  assert.deepEqual(
    imdbEvidence({ external: { imdb: { ratingAverage: "8.1", ratingTotal: "1,200,000" } } }),
    { rating: 8.1, count: 1_200_000 },
  );
  assert.deepEqual(
    imdbEvidence({ external: { imdb: { ratingAverage: 11, ratingTotal: 12_345 } } }),
    { rating: "", count: 12_345 },
  );
  assert.deepEqual(
    imdbEvidence({ external: { imdb: { ratingAverage: 6.9, ratingTotal: -1 } } }),
    { rating: 6.9, count: "" },
  );
  assert.deepEqual(imdbEvidence({ imdbRating: 7.4, imdbRatingCount: 12_345 }), { rating: "", count: "" });
  assert.deepEqual(
    imdbEvidence({ external: { imdb: { ratingAverage: "8.1", ratingTotal: "1.2m" } } }),
    { rating: 8.1, count: "" },
  );
  assert.deepEqual(imdbEvidence({ highlightRating: 4 }), { rating: "", count: "" });
});

test("CSV quotes commas and formula-like cells and includes a UTF-8 BOM", () => {
  const csv = csvFromRatings([
    {
      taste_order: 1,
      title: '=HYPERLINK("bad")',
      year: 2020,
      type: "Movie",
      taste_rating: 2,
      taste_rating_label: "Meh",
      taste_slug: "odd",
      taste_url: "https://www.taste.io/movies/odd",
      runtime_minutes: "",
      genres: "Comedy, Drama",
      directors: "",
      cast: "",
      imdb_rating: "",
      imdb_rating_count: "",
      rated_at: "",
      exported_at: "now",
    },
  ]);

  assert.ok(csv.startsWith("\uFEFFtaste_order,title,year"));
  assert.equal(
    csv.slice(1).split("\r\n")[0],
    "taste_order,title,year,type,taste_rating,taste_rating_label,taste_slug,taste_url,runtime_minutes,genres,directors,cast,imdb_rating,imdb_rating_count,rated_at,exported_at",
  );
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Comedy, Drama"/);
});

test("filename is safe and date-stamped", () => {
  assert.equal(
    filenameFor("Eric Wilson/../", new Date("2026-09-04T20:00:00Z")),
    "taste-ratings-eric-wilson-2026-09-04.csv",
  );
});
