import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname);
const src = resolve(root, "src");
const dist = resolve(root, "dist");
const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  target: "chrome120",
  format: "iife",
  platform: "browser",
  sourcemap: false,
  logLevel: "info",
};

// Entry points that must be bundled per output file name.
const entries = [
  { in: resolve(src, "background/service-worker.ts"), out: resolve(dist, "service-worker.js") },
  { in: resolve(src, "content/content.ts"), out: resolve(dist, "content.js") },
  { in: resolve(src, "popup/popup.ts"), out: resolve(dist, "popup.js") },
  { in: resolve(src, "options/options.ts"), out: resolve(dist, "options.js") },
];

function clean() {
  if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
}

function copyStatic() {
  // manifest
  cpSync(resolve(src, "manifest.json"), resolve(dist, "manifest.json"));

  // html + css assets (referenced relatively by manifest)
  cpSync(resolve(src, "popup/popup.html"), resolve(dist, "popup.html"));
  cpSync(resolve(src, "popup/popup.css"), resolve(dist, "popup.css"));
  cpSync(resolve(src, "options/options.html"), resolve(dist, "options.html"));
  cpSync(resolve(src, "options/options.css"), resolve(dist, "options.css"));

  // icons: copy only the manifest-referenced sizes (exclude source art like main.png)
  if (existsSync(resolve(root, "icons"))) {
    mkdirSync(resolve(dist, "icons"), { recursive: true });
    for (const size of [16, 32, 48, 128]) {
      const file = `icon${size}.png`;
      const from = resolve(root, "icons", file);
      if (existsSync(from)) cpSync(from, resolve(dist, "icons", file));
    }
  }
}

async function buildAll() {
  clean();
  if (watch) {
    // esbuild watch handles rebuilds but not static copies; do static first.
    copyStatic();
    for (const entry of entries) {
      const ctx = await context({
        ...shared,
        entryPoints: [entry.in],
        outfile: entry.out,
      });
      await ctx.watch();
    }
    console.log("Watching TypeScript sources... (edit manifest/html/css then re-run npm run build)");
  } else {
    for (const entry of entries) {
      await build({ ...shared, entryPoints: [entry.in], outfile: entry.out });
    }
    copyStatic();
    console.log("Build complete → dist/");
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
