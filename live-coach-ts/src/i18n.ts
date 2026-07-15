/*
 * Tiny locale picker.
 * `t(ru, en)` returns the value for the language this bundle was built for.
 * LOCALE is replaced by esbuild at build time, so RU and EN produce two files.
 */

export type Lang = "ru" | "en";

/** Pick the value for the current build language (works for strings or arrays). */
export const t = <T>(ru: T, en: T): T => (LOCALE === "ru" ? ru : en);

/** The active language of this bundle. */
export const LANG: Lang = LOCALE;
