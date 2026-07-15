/*
 * Locale selector.
 * ================
 * `L` is the active language pack. `LOCALE` is replaced by esbuild at build
 * time (define), so this ternary folds to one pack and the other is
 * tree-shaken away — each output bundle contains a single language.
 *
 * Everything user-facing lives in src/locales/{ru,en}.ts behind the shared
 * `Copy` contract; import `L` and read `L.someKey`.
 */

import type { Copy } from "./locales/contract";
import { ru } from "./locales/ru";
import { en } from "./locales/en";

export type Lang = "ru" | "en";

/** The active copy pack for this build. */
export const L: Copy = LOCALE === "ru" ? ru : en;

/** The active language of this bundle. */
export const LANG: Lang = LOCALE;
