// Builds a CRX signed with the verified-upload key for Chrome Web Store
// "verified CRX uploads". Chrome does the signing; this script only stages the
// runtime files so the CRX contains exactly what the zip would.
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stageRuntimeFiles } from "./package.mjs";

const CHROME = process.env.CHROME_BIN
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const KEY = process.env.CRX_KEY
  || path.join(os.homedir(), ".config/taste-io-export/verified-upload-key.pem");

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await fs.readFile(path.join(rootDirectory, "manifest.json"), "utf8"));
await fs.access(KEY).catch(() => {
  throw new Error(`Signing key not found at ${KEY}. Set CRX_KEY to override.`);
});

const staging = await fs.mkdtemp(path.join(os.tmpdir(), "taste-io-export-"));
const extensionDirectory = path.join(staging, "extension");
await stageRuntimeFiles(rootDirectory, extensionDirectory);
execFileSync(CHROME, [
  `--pack-extension=${extensionDirectory}`,
  `--pack-extension-key=${KEY}`,
  "--no-message-box",
], { stdio: "inherit" });

const outputDirectory = path.join(rootDirectory, "dist");
await fs.mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, `taste-io-ratings-exporter-${manifest.version}.crx`);
await fs.copyFile(path.join(staging, "extension.crx"), outputPath);
await fs.rm(staging, { recursive: true });
console.log(path.relative(rootDirectory, outputPath));
