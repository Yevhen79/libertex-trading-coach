/*
 * Copy — the coach's voice (localised RU / EN via `t`).
 * All user-facing tone lives here. Edit freely: pure strings can't break logic.
 *
 * Placeholders: {a} = instrument alias, {v} = signed money (e.g. −$4.82).
 */

import { t } from "./i18n";

/** Openers rotated after a losing trade. */
export const LOSS: string[] = t(
  [
    "Ну что ж, <b>{a}</b> закрылась в минус на <b>{v}</b> — бывает у всех.",
    "В этот раз не срослось: <b>{a}</b> ушла в <b>{v}</b>. Идём дальше. 🙂",
    "Минус по <b>{a}</b> — <b>{v}</b>. Это часть игры, извлечём урок.",
    "Не повезло — <b>{a}</b> закрылась в <b>{v}</b>. Не бери близко к сердцу.",
    "<b>{a}</b> ушла в красную зону: <b>{v}</b>. Главное — что дальше.",
  ],
  [
    "Well, <b>{a}</b> closed at a loss of <b>{v}</b> — it happens to everyone.",
    "Not this time: <b>{a}</b> went to <b>{v}</b>. Moving on. 🙂",
    "A loss on <b>{a}</b> — <b>{v}</b>. Part of the game, let's learn from it.",
    "Unlucky — <b>{a}</b> closed at <b>{v}</b>. Don't take it to heart.",
    "<b>{a}</b> slipped into the red: <b>{v}</b>. What matters is what's next.",
  ],
);

/** Openers rotated after a winning trade. */
export const WIN: string[] = t(
  [
    "Красиво — плюс по <b>{a}</b> на <b>{v}</b>! 👍",
    "Зелёная сделка: <b>{a}</b> закрыта в <b>{v}</b>. Молодец. 🙂",
    "Ты зафиксировал <b>{v}</b> по <b>{a}</b> — хорошая работа. ✅",
    "Вот так и надо — <b>{a}</b> в плюс на <b>{v}</b>.",
    "В плюс по <b>{a}</b>: <b>{v}</b>. Так держать!",
  ],
  [
    "Nice — a gain on <b>{a}</b> of <b>{v}</b>! 👍",
    "Green trade: <b>{a}</b> closed at <b>{v}</b>. Well done. 🙂",
    "You booked <b>{v}</b> on <b>{a}</b> — good work. ✅",
    "That's the way — <b>{a}</b> up by <b>{v}</b>.",
    "In the green on <b>{a}</b>: <b>{v}</b>. Keep it up!",
  ],
);

/** Word for the size of a LOSS, given its % of deposit. */
export const magW = (p: number): string =>
  p < 0.5 ? t("почти незаметный", "barely noticeable")
  : p < 1.5 ? t("небольшой", "small")
  : p < 4 ? t("заметный", "noticeable")
  : p < 8 ? t("существенный", "significant")
  : t("крупный", "large");

/** Word for the size of a GAIN, given its % of deposit. */
export const magWW = (p: number): string =>
  p < 0.5 ? t("скромный", "modest")
  : p < 1.5 ? t("неплохой", "decent")
  : p < 4 ? t("хороший", "good")
  : p < 8 ? t("солидный", "solid")
  : t("крупный", "large");
