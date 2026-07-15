# Libertex Trading Coach — TypeScript source

Читаемый, типизированный и **модульный** исходник поведенческого коуча **Guardian**,
который вставляется в консоль веб-терминала Libertex. Разбит на три слоя —
**данные / алгоритм / визуальная часть**. Все тексты локализованы (`t(ru, en)`),
и esbuild собирает **два** self-executing JS-файла — русский и английский:

- `dist/trading-coach-ru.js` — русский UI
- `dist/trading-coach-en.js` — английский UI

Язык «запекается» на этапе сборки через esbuild `define:LOCALE`, поэтому обёртка
`t(ru, en)` в рантайме отдаёт нужный язык, а на выходе — два готовых файла.

## Структура

```
live-coach-ts/
├─ src/
│  ├─ types.ts      ← ДАННЫЕ: все интерфейсы/типы (Trade, CoachState, ReviewData…)
│  ├─ config.ts     ← глобальные настройки (API, REVIEW_EVERY, палитра, POLL_MS, NAV)
│  ├─ format.ts     ← чистые числовые/строковые хелперы (pnl, fmt, sgn, median…)
│  ├─ state.ts      ← общее изменяемое состояние S + readBalance + rotate
│  ├─ messages.ts   ← КОПИРАЙТ: тексты (LOSS/WIN) и слова величины (magW/magWW)
│  ├─ detect.ts     ← АЛГОРИТМ: поведенческие правила по сделке (+ пороги, комментарии)
│  ├─ comment.ts    ← АЛГОРИТМ: сборка карточки разбора из одной сделки
│  ├─ review.ts     ← АЛГОРИТМ: N-сделочный разбор + формулы скоров (комментарии)
│  ├─ ui.ts         ← ВИЗУАЛ: окно, плашка, рендер, разбор, анимация, drag
│  ├─ i18n.ts       ← локаль-пикер t(ru, en)
│  ├─ env.d.ts      ← объявление build-константы LOCALE
│  └─ index.ts      ← точка входа: restore state → mount → poll-цикл → start
├─ dist/
│  ├─ trading-coach-ru.js   ← собранный русский файл для консоли
│  └─ trading-coach-en.js   ← собранный английский файл для консоли
├─ build.mjs                ← esbuild-сборка обоих языков (define:LOCALE)
├─ tsconfig.json            ← проверка типов (strict; noEmit — сборка через esbuild)
├─ package.json             ← npm-скрипты
└─ README.md
```

**Где искать правила.** Каждое поведенческое правило — это один `if`/порог в
`detect.ts` (паттерны по сделке) или формула в `review.ts` (скоры). Рядом с
каждым правилом стоит комментарий `// RULE — …` и именованная константа порога,
так что правило легко найти по тексту и понять, на что оно влияет.

## Сборка

Нужен Node.js (проверено на портативном Node 22).

```bash
npm install        # esbuild + typescript
npm run build      # node build.mjs: собирает dist/trading-coach-ru.js И -en.js
npm run typecheck  # tsc --noEmit: строгая проверка типов
npm run check      # typecheck + build
npm run build:watch # пересборка обоих файлов на каждое изменение
```

На этом ноутбуке (портативный Node):

```bash
export PATH="/c/Users/shakotko-ea/node22:$PATH"
cd guardian-angel-libertex/live-coach-ts
npm install && npm run check
```

## Использование

1. `npm run build` → `dist/trading-coach-ru.js` и `dist/trading-coach-en.js`.
2. Открыть `https://app.libertex.org` (или `/m`), залогиниться, выбрать счёт.
3. DevTools → Console → (если Chrome ругается) напечатать `разрешить вставку` → Enter.
4. Вставить нужный файл (`-ru` или `-en`) целиком → Enter.
5. Появляется виджет «Trading Coach». Раз в 5 сделок — полный AI-разбор со скорами.

> Виджет живёт в памяти страницы. Hard reload (F5) убирает его — вставь заново.

## Локализация и сборка

Исходник — ES-модули с `import`/`export`. Все тексты обёрнуты в `t(ru, en)`
(`i18n.ts`). `build.mjs` вызывает esbuild дважды, подставляя `LOCALE` через
`define`: получаются два самозапускающихся IIFE — `-ru.js` и `-en.js`. Каждый
исполняется сразу при вставке в консоль и ничего не оставляет в глобальной области
страницы. `tsc` только проверяет типы (`--noEmit`).

> Примечание: сейчас оба языка физически присутствуют в каждом файле, а `t()`
> выбирает нужный по `LOCALE` (запечён на сборке). Функционально это два корректных
> файла РУ/АНГЛ. Для «чистого» разделения (каждый файл — только свой язык) можно
> перейти на выбор через один объект-словарь + tree-shaking — скажи, если нужно.

## Что менять

- **Каденция разбора:** `REVIEW_EVERY` в `config.ts`.
- **Тексты/тон:** `t("ру", "en")` в `messages.ts`, `detect.ts`, `review.ts`, `comment.ts`, `ui.ts`.
- **Цвета/стиль:** объект `C` в `config.ts` и разметка в `ui.ts`.
- **Поведенческие пороги:** константы в начале `detect.ts` (`REVENGE_WINDOW_MS`,
  `CONCENTRATION_PCT`, `LEVERAGE_BANDS`, …).
- **Формулы скоров:** блок `SCORES` в `review.ts` — каждая формула прокомментирована.

Русские тексты перенесены дословно (поведение RU сохранено), английские — перевод
текущих формулировок. Смена тона и 4 продуктовые фичи из ТЗ — следующий шаг.
