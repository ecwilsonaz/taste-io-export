import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RUNTIME_FILES = Object.freeze([
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
]);

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function localHeader(name, data, checksum) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x0021, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(name, data, checksum, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x0021, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

export async function buildArchive(rootDirectory) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const relativePath of RUNTIME_FILES) {
    const name = Buffer.from(relativePath, "utf8");
    const data = await fs.readFile(path.join(rootDirectory, relativePath));
    const checksum = crc32(data);
    const local = localHeader(name, data, checksum);
    localParts.push(local, name, data);
    centralParts.push(centralHeader(name, data, checksum, localOffset), name);
    localOffset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(RUNTIME_FILES.length, 8);
  end.writeUInt16LE(RUNTIME_FILES.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function packageExtension() {
  const scriptPath = fileURLToPath(import.meta.url);
  const rootDirectory = path.resolve(path.dirname(scriptPath), "..");
  const manifest = JSON.parse(await fs.readFile(path.join(rootDirectory, "manifest.json"), "utf8"));
  const outputDirectory = path.join(rootDirectory, "dist");
  const outputPath = path.join(
    outputDirectory,
    `taste-io-ratings-exporter-${manifest.version}.zip`,
  );
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(outputPath, await buildArchive(rootDirectory));
  console.log(path.relative(rootDirectory, outputPath));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await packageExtension();
}
