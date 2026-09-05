# Privacy Policy

**Effective September 4, 2026**

Taste.io Ratings Exporter is an independent open-source Chrome extension. It is not affiliated with, endorsed by, or operated by Taste.io.

## Summary

Your ratings stay between Taste.io and your browser. The extension reads ratings from the Taste.io profile you choose, builds a CSV locally, and downloads that file to your computer. The developer does not receive your ratings or credentials. The extension has no server, account system, analytics, advertising, or tracking.

## Information the extension accesses

Only when you start an export, the extension accesses:

- **Taste.io profile and rating information** returned for the selected profile, including titles, ratings, rating order, and available title metadata.
- **The profile URL and username** needed to identify the list being exported and name the downloaded file.
- **Your existing Taste.io browser session** so Taste.io can answer requests in the same way it does for the page you opened. The extension does not read, copy, or store your password or authentication cookies.

## How information is used

The accessed information is used only to assemble the CSV you requested, check that the export is complete, display export progress, and download the finished file to your device. Processing happens locally in your browser.

## Network requests and disclosure

During an export, the extension sends requests only to `www.taste.io` to retrieve the selected profile's rating pages. It does not send ratings, browsing activity, credentials, or other personal information to the developer or to any analytics, advertising, data-broker, or other third-party service.

The extension does not sell, rent, share, or use personal information for advertising, credit decisions, or purposes unrelated to the user-requested export.

## Storage and retention

The extension does not maintain a database or developer-operated server. Rating data is kept in memory only while an export is running. The resulting CSV is saved through Chrome's normal download process and remains on your device until you move or delete it. The extension does not retain a copy.

## Chrome permissions

- **Access to Taste.io rating pages:** the content script is limited to URLs matching `https://www.taste.io/users/*/ratings*` so the exporter can appear, retrieve the selected profile's paginated ratings, and create the requested CSV.

The extension requests no named Chrome API permissions. It does not request access to arbitrary websites, your general browsing history, clipboard, location, contacts, microphone, or camera.

## Privacy-policy website

The [public version of this policy](https://ecwilsonaz.github.io/taste-io-export/) is a static GitHub Pages site. It uses no cookies, analytics, forms, third-party fonts, or embedded third-party media. GitHub may process limited technical information when serving Pages; that processing is governed by [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Your choices

Exporting is voluntary and begins only when you select the export command. You can stop using the extension at any time by disabling or uninstalling it in Chrome. You control the CSV after it is downloaded and can delete it like any other local file.

## Children's privacy

The extension is not directed to children and the developer does not knowingly collect personal information from children—or from anyone else—through the extension.

## Changes to this policy

If the extension's data practices change, this policy will be updated before the change is released, and the effective date above will be revised. The repository's version history provides a public record of policy changes.

## Contact

Questions or privacy concerns can be submitted through the project's [GitHub issue tracker](https://github.com/ecwilsonaz/taste-io-export/issues). Please do not include passwords, cookies, exported CSV files, or other sensitive information in a public issue.
