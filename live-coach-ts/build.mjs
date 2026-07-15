/*
 * Build script — bundles the coach into one self-executing IIFE per language.
 * Each locale is baked in at build time via esbuild's `define` (LOCALE), so the
 * `t(ru, en)` picker resolves to a single language and the two outputs are:
 *   dist/trading-coach-ru.js   (Russian UI)
 *   dist/trading-coach-en.js   (English UI)
 *
 * Run:  node build.mjs            (build both once)
 *       node build.mjs --watch    (rebuild both on change)
 */

import * as esbuild from "esbuild";

const LANGS = ["ru", "en"];
const watch = process.argv.includes("--watch");

/** esbuild options for one language. */
const optionsFor = (lang) => ({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "iife",
  target: "es2019",
  charset: "utf8",
  legalComments: "none",
  define: { LOCALE: JSON.stringify(lang) },
  outfile: `dist/trading-coach-${lang}.js`,
  logLevel: "info",
});

if (watch) {
  for (const lang of LANGS) {
    const ctx = await esbuild.context(optionsFor(lang));
    await ctx.watch();
  }
  console.log("Watching src/ — rebuilding trading-coach-ru.js and trading-coach-en.js on change.");
} else {
  await Promise.all(LANGS.map((lang) => esbuild.build(optionsFor(lang))));
  console.log("Built dist/trading-coach-ru.js and dist/trading-coach-en.js");
}
