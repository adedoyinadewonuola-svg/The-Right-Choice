#!/usr/bin/env node
/**
 * Extract Server Action ids from the dev build output.
 *
 * Server Action ids are generated per build and live only in the per-page
 * `server-reference-manifest.json` files under `.next/dev/`. They change on every
 * `next dev` start, so anything that drives actions from the shell must re-run this
 * first. A stale id makes the POST fail with 404 "Server action not found" —
 * or, if the action belongs to a different page's bundle, the same thing.
 *
 * Usage:  node scripts/action-ids.mjs           # writes scripts/.action-ids.txt
 *         node scripts/action-ids.mjs --stdout  # just print them
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const nextDir = path.join(appRoot, ".next");

if (!fs.existsSync(nextDir)) {
  console.error(`No build output at ${nextDir}. Start the dev server (\`npm run dev\`) first.`);
  process.exit(1);
}

const found = new Map();

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "server-reference-manifest.json") {
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(full, "utf8"));
      } catch {
        continue;
      }
      for (const [id, info] of Object.entries(manifest.node ?? {})) {
        const name = info?.exportedName;
        // Keep the first one seen; ids are unique per build, and a page may bundle
        // an action several times.
        if (name && !found.has(name)) found.set(name, id);
      }
    }
  }
}

walk(nextDir);

const lines = [...found.entries()].map(([name, id]) => `${name} ${id}`);

if (lines.length === 0) {
  console.error("No Server Action ids found. Visit each page once so Turbopack compiles it.");
  process.exit(1);
}

if (process.argv.includes("--stdout")) {
  console.log(lines.join("\n"));
} else {
  const outFile = path.join(here, ".action-ids.txt");
  fs.writeFileSync(outFile, lines.join("\n") + "\n");
  console.log(`${lines.length} action ids -> ${path.relative(appRoot, outFile)}`);
}
