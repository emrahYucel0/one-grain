// Safari/iOS 15 compatibility of what ships (npm run check:compat): builds the site, then parses every
// script in dist/ (espree, the parser ESLint uses) and scans the stylesheet for what Safari 15 lacks.
// The build target (vite.config.ts) transforms syntax and the compat lint (eslint-plugin-compat, on
// src/) flags web APIs; this checks the result, dependencies included.
//   syntax:  class static blocks, regex lookbehind, the regex v flag, `using` declarations
//   methods: toSorted / toReversed / toSpliced / with, Object.groupBy / Map.groupBy,
//            Promise.withResolvers, AbortSignal.timeout / any, Array.fromAsync (Safari 16+ or 17+);
//            and the Safari 15.4 additions (at, findLast, structuredClone, Object.hasOwn), reported
//            separately: iOS 15.8, the last update of the iPhone 6s/7 generation, has them
//   CSS:     nesting, container queries, color-mix(), @scope, :has() (15.4 too)
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as espree from 'espree';
import { build } from 'vite';

await build({ logLevel: 'error' });
const DIR = 'dist/assets';
const files = (await readdir(DIR)).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };

const NEWER = new Set(['toSorted', 'toReversed', 'toSpliced', 'groupBy', 'withResolvers', 'fromAsync']);
const NEWER_STATIC = { AbortSignal: ['timeout', 'any'] };
const V154 = new Set(['findLast', 'findLastIndex', 'structuredClone', 'hasOwn']);
const found = { syntax: [], methods: [], v154: [], css: [] };

const walk = (node, visit) => {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, visit));
    else if (v && typeof v.type === 'string' && k !== 'parent') walk(v, visit);
  }
};

for (const f of files) {
  const src = await readFile(join(DIR, f), 'utf8');
  if (f.endsWith('.css')) {
    const css = src.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [re, what] of [[/\{[^{}]*&[^{}]*\{/, 'CSS nesting'], [/@container\b/, 'container query'], [/color-mix\(/, 'color-mix()'], [/@scope\b/, '@scope'], [/:has\(/, ':has() (15.4)']]) {
      if (re.test(css)) found.css.push(`${f}: ${what}`);
    }
    continue;
  }
  let ast;
  try { ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch (e) { found.syntax.push(`${f}: does not parse (${e.message})`); continue; }
  walk(ast, (n) => {
    if (n.type === 'StaticBlock') found.syntax.push(`${f}: class static block`);
    if (n.type === 'VariableDeclaration' && /using/.test(n.kind)) found.syntax.push(`${f}: using declaration`);
    if (n.type === 'Literal' && n.regex) {
      if (/\(\?<[=!]/.test(n.regex.pattern)) found.syntax.push(`${f}: regex lookbehind /${n.regex.pattern.slice(0, 40)}/`);
      if (n.regex.flags.includes('v')) found.syntax.push(`${f}: regex v flag`);
    }
    // method calls only: a property that happens to share a name (an object's own `at`) is not one
    const c = n.type === 'CallExpression' ? n.callee : null;
    if (c?.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier') {
      const p = c.property.name, o = c.object.type === 'Identifier' ? c.object.name : null;
      if (NEWER.has(p) || p === 'with' || (o && NEWER_STATIC[o]?.includes(p))) found.methods.push(`${f}: ${o ? `${o}.` : '.'}${p}()`);
      if (V154.has(p) || p === 'at') found.v154.push(`${f}: .${p}()`);
    }
    if (n.type === 'Identifier' && n.name === 'structuredClone') found.v154.push(`${f}: structuredClone`);
  });
}
const uniq = (a) => [...new Set(a)];
check('syntax Safari 15 cannot parse (static blocks, lookbehind, v flag, using)', found.syntax.length === 0, uniq(found.syntax).join('; ') || `none in ${files.length} files`);
check('methods newer than Safari 15 (toSorted…, groupBy, withResolvers, AbortSignal.timeout…)', found.methods.length === 0, uniq(found.methods).join('; ') || 'none');
check('CSS newer than Safari 15 (nesting, container queries, color-mix, @scope)', found.css.filter((c) => !c.includes('15.4')).length === 0, uniq(found.css).join('; ') || 'none');
console.log(`INFO  Safari 15.4 additions (fine on iOS 15.8, missing on 15.0–15.3): ${uniq(found.v154).join('; ') || 'none'}`);
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
