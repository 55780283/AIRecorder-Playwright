const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const zipName = `ai-recorder-${manifest.version}.zip`;
const distDir = path.join(root, "dist");

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

const entries = [
  "manifest.json",
  "background",
  "content",
  "popup",
  "sidebar",
  "utils",
  "icons",
];

for (const name of entries) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) {
    console.error(`Missing required path: ${name}`);
    process.exit(1);
  }
}

const zipPath = path.join(distDir, zipName);
execFileSync("zip", ["-r", zipPath, ...entries], { cwd: root, stdio: "inherit" });
console.log(`Packed: ${zipPath}`);
