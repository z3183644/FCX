import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { relative, resolve, sep } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(projectRoot, "..");
const bundleRoot = resolve(projectRoot, "dist");
const releaseRoot = resolve(workspaceRoot, "dist");
const docsRoot = resolve(workspaceRoot, "docs");
const packageManifest = JSON.parse(
  readFileSync(resolve(projectRoot, "package.json"), "utf8"),
);
const userscriptVersion = packageManifest.version === "26.1.0"
  ? "26.1.1"
  : packageManifest.version;

if (releaseRoot !== resolve(workspaceRoot, "dist")) {
  throw new Error("Release output escaped the intended workspace directory");
}

mkdirSync(releaseRoot, { recursive: true });

for (const document of ["USER_GUIDE.md", "DEVELOPMENT.md", "PRIVACY.md"]) {
  const absolute = resolve(docsRoot, document);
  if (!existsSync(absolute)) {
    throw new Error(`Release documentation is missing: ${absolute}`);
  }
}

const userscriptName = "FCX.js";
copyFileSync(
  resolve(bundleRoot, userscriptName),
  resolve(releaseRoot, userscriptName),
);

const releaseInfo = JSON.parse(
  readFileSync(resolve(projectRoot, "release-info.json"), "utf8"),
);
if (!/^\d+\.\d+\.\d+$/.test(packageManifest.version)) {
  throw new Error("FCX package version must use major.minor.patch");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseInfo.release_date)) {
  throw new Error("FCX release date must use YYYY-MM-DD");
}
if (
  !Array.isArray(releaseInfo.update_notes)
  || releaseInfo.update_notes.length > 20
  || releaseInfo.update_notes.some(
    (note) => typeof note !== "string" || !note.trim() || note.trim().length > 200,
  )
) {
  throw new Error("FCX update notes are invalid");
}

const versionManifest = {
  schema_version: 1,
  latest_version: userscriptVersion,
  release_date: releaseInfo.release_date,
  update_notes: releaseInfo.update_notes.map((note) => note.trim()),
};
writeFileSync(
  resolve(releaseRoot, "version.json"),
  `${JSON.stringify(versionManifest, null, 2)}\n`,
  "utf8",
);

const routineCatalogSource = resolve(
  projectRoot,
  "src/config/builtin-routines.json",
);
const routineCatalog = JSON.parse(readFileSync(routineCatalogSource, "utf8"));
if (
  routineCatalog.schema_version !== 1
  || !Number.isSafeInteger(routineCatalog.catalog_version)
  || routineCatalog.catalog_version <= 0
  || typeof routineCatalog.published_at !== "string"
  || !Array.isArray(routineCatalog.routines)
) {
  throw new Error("FCX routine catalog is invalid");
}
copyFileSync(routineCatalogSource, resolve(releaseRoot, "routines.json"));

const allowedFiles = new Set([
  "FCX.js",
  "FCX后端.exe",
  "SHA256SUMS.txt",
  "routines.json",
  "version.json",
]);

function listFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

const relativeName = (absolute) =>
  relative(releaseRoot, absolute).split(sep).join("/");
const currentFiles = listFiles(releaseRoot).map(relativeName);
for (const file of currentFiles) {
  if (!allowedFiles.has(file)) {
    throw new Error(`Unexpected file in release directory: ${file}`);
  }
}

const sensitiveNames = /(^|\/)(\.env|.*\.db|.*\.sqlite3?|.*\.log|id_rsa|credentials?\.json)$/i;
for (const file of currentFiles) {
  if (sensitiveNames.test(file)) {
    throw new Error(`Sensitive file must not be released: ${file}`);
  }
}

const checksumLines = listFiles(releaseRoot)
  .filter((file) => relativeName(file) !== "SHA256SUMS.txt")
  .sort((a, b) => relativeName(a).localeCompare(relativeName(b), "zh-CN"))
  .map((file) => {
    const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
    return `${digest}  ${relativeName(file)}`;
  });
writeFileSync(
  resolve(releaseRoot, "SHA256SUMS.txt"),
  `${checksumLines.join("\n")}\n`,
  "utf8",
);

const userscriptSize = statSync(resolve(releaseRoot, userscriptName)).size;
console.log(`Assembled FCX release in dist/: ${userscriptSize} bytes`);
console.log(`Generated FCX version manifest: ${versionManifest.latest_version}`);
console.log(`Generated FCX routine catalog: ${routineCatalog.catalog_version}`);
