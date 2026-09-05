# Taste.io Ratings Exporter

A small Chrome extension that downloads a Taste.io user’s complete movie and TV rating history as CSV.

The extension uses Taste’s own paginated ratings endpoint from the ratings page you already have open. It processes everything locally in the browser: there is no server, account, analytics, or credential collection.

Read the public [privacy policy](https://ecwilsonaz.github.io/taste-io-export/). Its source lives in [`PRIVACY.md`](PRIVACY.md), and the published GitHub Pages site lives in [`docs/`](docs/).

## Install a release ZIP

Chrome loads an extracted extension folder rather than the ZIP file itself.

1. Download the release ZIP and extract it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Choose the extracted folder containing `manifest.json`.
6. Open a page such as `https://www.taste.io/users/USERNAME/ratings` and select **Export ratings**.

## Install from source

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Choose this repository folder.
5. Open a page such as `https://www.taste.io/users/USERNAME/ratings`.
6. Click **Export ratings** on the page, or click the extension’s toolbar icon.

Chrome does not automatically refresh unpacked extensions. After changing the source, click the extension’s reload button on `chrome://extensions`, then reload the Taste page.

## CSV columns

| Column | Meaning |
| --- | --- |
| `taste_order` | Newest-first position returned by Taste at export time. |
| `title`, `year`, `type` | The rated movie or TV show. |
| `taste_rating` | The profile owner’s Taste value: 1–4. |
| `taste_rating_label` | `Awful`, `Meh`, `Good`, or `Amazing`. |
| `taste_slug`, `taste_url` | Stable Taste identifiers/links where available. |
| `runtime_minutes`, `genres` | Content metadata returned with the rating. |
| `directors`, `cast` | Stable identity evidence for later catalog matching. |
| `imdb_rating`, `imdb_rating_count` | IMDb aggregate values exposed by Taste. These are matching evidence, not an IMDb identifier. |
| `rated_at` | Blank. Taste’s endpoint does not expose a rating timestamp. |
| `exported_at` | UTC time when the CSV was produced. |

The extension always requests the unfiltered ratings list, even if the open page is filtered to movies, TV, or one rating tier. Rows are deduplicated and the final count is checked against Taste’s page data when that count is available. If the list changes during a long export and the counts do not agree, no incomplete file is downloaded. If Taste does not identify a row as the profile owner’s rating, the export stops instead of substituting the signed-in viewer’s rating.

## Development

No build step or package install is required.

```sh
npm test
npm run package
```

`npm run package` writes a deterministic, versioned archive to `dist/`. The manifest and extension files are at the archive root, ready to extract and load. The extension is Manifest V3 and uses no third-party dependencies.

## Known limitation

Taste returns ratings in newest-first order but does not include the calendar date when a rating was made. `taste_order` preserves that chronology; it is not a date and may change if older ratings are edited or re-rated.

Taste does not expose an IMDb `tt…` identifier in the ratings payload. The IMDb score and vote count can help corroborate a later title/year match, but both values change over time and must not be treated as identity.

## License

MIT
