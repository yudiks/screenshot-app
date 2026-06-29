#!/usr/bin/env node
// Takes a screenshot, uploads it, and opens the annotation page.
// Usage:  node screenshot.mjs [--url https://your-app.vercel.app]
//         SCREENSHOT_APP_URL=https://... node screenshot.mjs

import { execSync, spawnSync } from "child_process";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const BASE_URL =
  process.argv[process.argv.indexOf("--url") + 1] ??
  process.env.SCREENSHOT_APP_URL ??
  "https://web-tau-six-58.vercel.app";

const TMP = join(tmpdir(), `screenshot-${Date.now()}.png`);

console.log("Select a region to capture (press Escape to cancel)...");

const result = spawnSync("screencapture", ["-i", "-x", TMP], { stdio: "inherit" });

if (result.status !== 0 || !existsSync(TMP)) {
  console.log("Cancelled.");
  process.exit(0);
}

const bytes = readFileSync(TMP);
unlinkSync(TMP);

console.log(`Uploading ${(bytes.length / 1024).toFixed(0)} KB...`);

const form = new FormData();
form.append("file", new Blob([bytes], { type: "image/png" }), "screenshot.png");

let pageUrl;
try {
  const res = await fetch(`${BASE_URL}/api/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  ({ url: pageUrl } = await res.json());
} catch (err) {
  console.error("Upload failed:", err.message);
  process.exit(1);
}

const shareUrl = `${BASE_URL}${pageUrl}`;
console.log(`\nShare: ${shareUrl}\n`);
execSync(`open "${shareUrl}"`);
