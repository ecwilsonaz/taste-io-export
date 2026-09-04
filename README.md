# Taste.io Ratings Exporter

A small Chrome extension that downloads a Taste.io user’s complete movie and TV rating history as CSV.

The extension uses Taste’s own paginated ratings endpoint from the ratings page you already have open. It processes everything locally in the browser: there is no server, account, analytics, or credential collection.

## Install for development

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
| `rating` | Taste’s numeric value: 1–4. |
| `rating_label` | `Awful`, `Meh`, `Good`, or `Amazing`. |
| `taste_slug`, `taste_url` | Stable Taste identifiers/links where available. |
| `runtime_minutes`, `genres` | Extra metadata returned with the rating. |
| `rated_at` | Blank. Taste’s endpoint does not expose a rating timestamp. |
| `exported_at` | UTC time when the CSV was produced. |

The extension always requests the unfiltered ratings list, even if the open page is filtered to movies, TV, or one rating tier. Rows are deduplicated and the final count is checked against Taste’s page data when that count is available. If the list changes during a long export and the counts do not agree, no incomplete file is downloaded.

## Development

No build step or package install is required.

```sh
npm test
```

The extension is Manifest V3 and uses no third-party dependencies.

## Known limitation

Taste returns ratings in newest-first order but does not include the calendar date when a rating was made. `taste_order` preserves that chronology; it is not a date and may change if older ratings are edited or re-rated.

## License

MIT
