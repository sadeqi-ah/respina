#!/usr/bin/env node
// Fails on physical-direction CSS in src/ (plan §6 i18n): use logical utilities instead
// (ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e/rounded-s/rounded-e).
// A line that must stay physical (e.g. pointer math) can opt out with a `rtl-ok` comment.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src/", import.meta.url).pathname;
const VALUE = String.raw`[\w.\/\[\]%]+`;

// Tailwind classes, including variants (md:ml-2) and negatives (-left-1).
const CLASS = new RegExp(
  String.raw`(?<![\w-])-?(?:` +
    String.raw`(?:m[lr]|p[lr]|left|right|scroll-[mp][lr])-${VALUE}` + // ml-2, left-0, scroll-pl-4
    String.raw`|(?:border-[lr]|rounded-(?:[lr]|tl|tr|bl|br))(?:-${VALUE})?` + // border-l, rounded-tr-md
    String.raw`|text-(?:left|right)` +
    String.raw`)(?![\w-])`,
  "g",
);
// Plain CSS properties in .css files.
const CSS =
  /\b(?:margin|padding|border)-(?:left|right)\b|(?<![\w-])(?:left|right)\s*:|text-align\s*:\s*(?:left|right)|float\s*:\s*(?:left|right)/g;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

let problems = 0;
for (const file of files(ROOT)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes("rtl-ok")) return;
    const pattern = file.endsWith(".css") ? CSS : CLASS;
    for (const match of line.matchAll(pattern)) {
      problems++;
      console.log(`src/${relative(ROOT, file)}:${i + 1}:${match.index + 1}  ${match[0].trim()}`);
    }
  });
}

if (problems > 0) {
  console.error(
    `\nlint:rtl: ${problems} physical-direction class(es). Use logical ones (ms-/me-/start-/end-/text-start/…).`,
  );
  process.exit(1);
}
console.log("lint:rtl: ok");
