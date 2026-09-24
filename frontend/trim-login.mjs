// TEMP: drop the decorative TiltCard + CursorGlowLayer tail from Login.jsx
import fs from "node:fs";

const path = "src/pages/landing-page/Login.jsx";
let src = fs.readFileSync(path, "utf8");
const before = src.split(/\r?\n/).length;

// The login page component ends before the TiltCard helper block.
const m = src.match(/\r?\n\/\*+[^\n]*|/); // noop, keeps regex import used
const cut = src.search(/\r?\n\/\/ =+\r?\n\/\/ TiltCard/);
if (cut < 0) {
  console.log("TiltCard block not found — nothing removed");
  process.exit(0);
}
src = src.slice(0, cut).replace(/\s+$/, "") + "\n";
fs.writeFileSync(path, src);
console.log("lines before:", before, "after:", src.split(/\r?\n/).length);
console.log("still references TiltCard/CursorGlowLayer:",
  /TiltCard|CursorGlowLayer/.test(src));
console.log("last 3 lines:", JSON.stringify(src.split(/\r?\n/).slice(-4)));
