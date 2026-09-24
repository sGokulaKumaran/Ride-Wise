// TEMP validation for the theme token system — deleted after the run.
// Confirms all four themes expose exactly the same tokens, that the
// tokens used in the UI exist, and that no theme-specific leftovers
// (gradients, hardcoded grays) remain in the palette.
import fs from "node:fs";

const themeSrc = fs.readFileSync("src/pages/hooks/useTheme.js", "utf8");

// grab the four theme blocks
const themeNames = ["dark", "light", "warm", "midnight"];
const blocks = {};
for (const name of themeNames) {
  const start = themeSrc.indexOf(`\n  ${name}: {`);
  const end = themeSrc.indexOf("\n  },", start);
  blocks[name] = themeSrc.slice(start, end);
}

// token keys = "key:" at 4-space indent (skip nested preview keys)
const keysOf = (block) =>
  [...block.matchAll(/^ {4}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1]);

const ref = keysOf(blocks.dark);
console.log("tokens per theme:", ref.length);
for (const name of themeNames) {
  const keys = keysOf(blocks[name]);
  const missing = ref.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !ref.includes(k));
  console.log(`${name.padEnd(9)} ${keys.length} tokens` +
    (missing.length ? `  MISSING: ${missing.join(", ")}` : "") +
    (extra.length ? `  EXTRA: ${extra.join(", ")}` : ""));
}

// every tc.<token> used in the app must exist
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".jsx")) files.push(p);
  }
})("src");

const used = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\btc\.([a-zA-Z][a-zA-Z0-9]*)/g)) used.add(m[1]);
}
const unknown = [...used].filter((k) => !ref.includes(k));
console.log("tc.* tokens used in app:", [...used].sort().join(", "));
console.log("unknown tokens:", unknown.length ? unknown.join(", ") : "none");

// leftover decorative styling in the palette
const leftovers = ["gradient", "backdrop-blur", "shadow-xl", "shadow-2xl", "text-gray-", "bg-gray-"]
  .filter((p) => themeSrc.includes(p));
console.log("leftovers in useTheme.js:", leftovers.length ? leftovers.join(", ") : "none");
