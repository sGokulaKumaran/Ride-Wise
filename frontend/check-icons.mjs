// TEMP validation for the icon family — deleted after the run.
import fs from "node:fs";

const src = fs.readFileSync("src/pages/components/ui/Icon.jsx", "utf8");

// 1. icon names declared at the top level of the ICONS map
const names = [...src.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*): \($/gm)].map((m) => m[1]);

// 2. validate every path `d` attribute against the SVG path grammar
const ARITY = { M: 2, m: 2, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1, C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2, A: 7, a: 7, Z: 0, z: 0 };
function validatePath(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+/g) || [];
  let cmd = null;
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      if (!(t in ARITY)) return `unknown command "${t}"`;
      cmd = t;
      i += 1;
      if (ARITY[cmd] === 0) continue;
    } else if (!cmd) {
      return "number before any command";
    }
    const need = ARITY[cmd];
    if (need === undefined) return `unknown command "${cmd}"`;
    for (let k = 0; k < need; k++) {
      const v = tokens[i + k];
      if (v === undefined) return `missing argument ${k + 1} for "${cmd}" in "${d}"`;
      if (/[A-Za-z]/.test(v)) return `bad argument "${v}" for "${cmd}" in "${d}"`;
    }
    if (need === 0) continue;
    i += need;
  }
  return null;
}

const problems = [];
for (const m of src.matchAll(/\sd="([^"]+)"/g)) {
  const err = validatePath(m[1]);
  if (err) problems.push(`path "${m[1]}": ${err}`);
}

// 3. every numeric coordinate must stay inside the live area (-1 … 25)
for (const m of src.matchAll(/(?:cx|c|y2|x1|cy|cx|r|x|y|width|height|rx)="(-?[\d.]+)"/g)) {
  const v = Number(m[1]);
  if (Number.isFinite(v) && (v < -1 || v > 25)) problems.push(`coordinate out of grid: ${m[0]}`);
}

// 4. stroke weight must be declared once and used by every icon
const hasStroke = /const SW = [\d.]+/.test(src) && /strokeWidth=\{strokeWidth \?\? SW\}/.test(src);

console.log("icons found:", names.length);
console.log("names:", names.join(", "));
console.log("path syntax errors:", problems.length);
problems.forEach((p) => console.log("  -", p));
console.log("single stroke weight wired:", hasStroke ? "yes" : "NO");
