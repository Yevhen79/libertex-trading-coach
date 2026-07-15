/*
 * Build-time locale, injected by esbuild via `--define:LOCALE='"ru"'` (or "en").
 * `npm run typecheck` (tsc) only sees the type; the real value is substituted
 * at bundle time so each build carries a single language.
 */
declare const LOCALE: "ru" | "en";
