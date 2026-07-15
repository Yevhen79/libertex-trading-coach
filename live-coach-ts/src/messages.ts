/*
 * Copy — the coach's voice.
 * All user-facing tone lives here (per-trade openers and the words used to
 * describe magnitudes). Edit freely: these are pure strings, changing them
 * cannot break the algorithm.
 *
 * Placeholders: {a} = instrument alias, {v} = signed money (e.g. −$4.82).
 */

/** Openers rotated after a losing trade (warm, never scolding). */
export const LOSS: string[] = [
  "Ну что ж, <b>{a}</b> закрылась в минус на <b>{v}</b> — бывает у всех.",
  "В этот раз не срослось: <b>{a}</b> ушла в <b>{v}</b>. Идём дальше. 🙂",
  "Минус по <b>{a}</b> — <b>{v}</b>. Это часть игры, извлечём урок.",
  "Не повезло — <b>{a}</b> закрылась в <b>{v}</b>. Не бери близко к сердцу.",
  "<b>{a}</b> ушла в красную зону: <b>{v}</b>. Главное — что дальше.",
];

/** Openers rotated after a winning trade. */
export const WIN: string[] = [
  "Красиво — плюс по <b>{a}</b> на <b>{v}</b>! 👍",
  "Зелёная сделка: <b>{a}</b> закрыта в <b>{v}</b>. Молодец. 🙂",
  "Ты зафиксировал <b>{v}</b> по <b>{a}</b> — хорошая работа. ✅",
  "Вот так и надо — <b>{a}</b> в плюс на <b>{v}</b>.",
  "В плюс по <b>{a}</b>: <b>{v}</b>. Так держать!",
];

/** Word for the size of a LOSS, given its % of deposit. */
export const magW = (p: number): string =>
  p < 0.5 ? "почти незаметный" : p < 1.5 ? "небольшой" : p < 4 ? "заметный" : p < 8 ? "существенный" : "крупный";

/** Word for the size of a GAIN, given its % of deposit. */
export const magWW = (p: number): string =>
  p < 0.5 ? "скромный" : p < 1.5 ? "неплохой" : p < 4 ? "хороший" : p < 8 ? "солидный" : "крупный";
