# Libertex Trading Coach — TypeScript source

Читаемый, типизированный и **модульный** исходник поведенческого коуча **Guardian**,
который вставляется в консоль веб-терминала Libertex. Разбит на три слоя —
**данные / алгоритм / визуальная часть** — и собирается esbuild в один
self-executing JS-файл, идентичный по поведению рукописному
`../live-coach/trading-coach-inject.js`.

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
│  └─ index.ts      ← точка входа: restore state → mount → poll-цикл → start
├─ dist/trading-coach-inject.js  ← собранный файл для вставки в консоль
├─ tsconfig.json                 ← проверка типов (strict; noEmit — сборка через esbuild)
├─ package.json                  ← npm-скрипты
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
npm run build      # esbuild: бандлит src/index.ts → dist/trading-coach-inject.js
npm run typecheck  # tsc --noEmit: строгая проверка типов
npm run check      # typecheck + build
npm run watch      # пересборка на каждое изменение
```

На этом ноутбуке (портативный Node):

```bash
export PATH="/c/Users/shakotko-ea/node22:$PATH"
cd guardian-angel-libertex/live-coach-ts
npm install && npm run check
```

## Использование

1. `npm run build` → `dist/trading-coach-inject.js`.
2. Открыть `https://app.libertex.org` (или `/m`), залогиниться, выбрать счёт.
3. DevTools → Console → (если Chrome ругается) напечатать `разрешить вставку` → Enter.
4. Вставить содержимое `dist/trading-coach-inject.js` → Enter.
5. Появляется виджет «Trading Coach». Раз в 5 сделок — полный AI-разбор со скорами.

> Виджет живёт в памяти страницы. Hard reload (F5) убирает его — вставь заново.

## Почему esbuild

Исходник — это ES-модули с `import`/`export` (для наглядности разбит по файлам).
`esbuild --bundle --format=iife` собирает их в один самозапускающийся IIFE, который
исполняется сразу при вставке в консоль и ничего не оставляет в глобальной области
страницы. `tsc` при этом только проверяет типы (`--noEmit`), сборку делает esbuild —
быстро и без промежуточных файлов.

## Что менять

- **Каденция разбора:** `REVIEW_EVERY` в `config.ts` (сейчас 5).
- **Тексты/тон:** массивы `LOSS`/`WIN` и `magW`/`magWW` в `messages.ts`.
- **Цвета/стиль:** объект `C` в `config.ts` и разметка в `ui.ts`.
- **Поведенческие пороги:** константы в начале `detect.ts` (`REVENGE_WINDOW_MS`,
  `CONCENTRATION_PCT`, `LEVERAGE_BANDS`, …).
- **Формулы скоров:** блок `SCORES` в `review.ts` (Дисциплина / Консистентность /
  Рациональность) — каждая формула прокомментирована.

Поведение сборки сверено с рукописным JS (копирайт, id, цвета и числовые пороги
идентичны; runtime-монтаж проверен). Оригинальный
`../live-coach/trading-coach-inject.js` оставлен как есть — это два независимых
артефакта с одинаковым поведением.
