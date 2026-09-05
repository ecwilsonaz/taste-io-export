const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "..");

test("package.json exposes the release archive command", () => {
  const packageJson = require("../package.json");
  assert.equal(packageJson.scripts.package, "node scripts/package.mjs");
});

test("manifest loads runtime dependencies in order and shares the package version", () => {
  const manifest = require("../manifest.json");
  const packageJson = require("../package.json");
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.content_scripts[0].js, [
    "lib/export-core.js",
    "lib/export-runner.js",
    "lib/export-ui.js",
    "content.js",
  ]);
});

test("release archive is deterministic and contains only the supported distribution files", async () => {
  const { buildArchive, RUNTIME_FILES } = await import(
    pathToFileURL(path.join(REPO_ROOT, "scripts/package.mjs"))
  );
  const expectedFiles = [
    "manifest.json",
    "popup.html",
    "popup.js",
    "popup.css",
    "content.js",
    "content.css",
    "icons/icon-16.png",
    "icons/icon-32.png",
    "icons/icon-48.png",
    "icons/icon-128.png",
    "lib/export-core.js",
    "lib/export-runner.js",
    "lib/export-ui.js",
    "PRIVACY.md",
    "LICENSE",
    "README.md",
  ];

  assert.deepEqual(RUNTIME_FILES, expectedFiles);
  const first = await buildArchive(REPO_ROOT);
  const second = await buildArchive(REPO_ROOT);
  assert.deepEqual(first, second);
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt32LE(first.length - 22), 0x06054b50);
  for (const file of expectedFiles) assert.ok(first.includes(Buffer.from(file)), file);
});
