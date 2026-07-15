# Libertex Trading Coach — TypeScript source

Читаемый, типизированный исходник поведенческого коуча **Guardian**, который
вставляется в консоль веб-терминала Libertex. Компилируется в один
self-executing JS-файл — точно такой же по поведению, как рукописный
`../live-coach/trading-coach-inject.js`, но с типами, именованными функциями,
комментариями и шаблонными литералами вместо конкатенации строк.

## Структура

```
live-coach-ts/
├─ src/trading-coach-inject.ts   ← читаемый TypeScript-исходник (правим здесь)
├─ dist/trading-coach-inject.js  ← скомпилированный файл для вставки в консоль
├─ tsconfig.json                 ← настройки компиляции (strict, module:none → скрипт-IIFE)
├─ package.json                  ← npm-скрипты
└─ README.md
```

## Сборка

Нужен Node.js (проверено на портативном Node 22) и TypeScript.

```bash
npm install        # поставить typescript (один dev-зависимость)
npm run build      # tsc → dist/trading-coach-inject.js
npm run typecheck  # проверка типов без вывода (strict)
npm run watch      # пересборка на каждое изменение
```

На этом ноутбуке (портативный Node):

```bash
export PATH="/c/Users/shakotko-ea/node22:$PATH"
npm install && npm run build
```

## Использование

1. `npm run build` → получаем `dist/trading-coach-inject.js`.
2. Открыть `https://app.libertex.org` (или `/m` мобильный вид), залогиниться,
   выбрать нужный счёт.
3. DevTools → Console → (если Chrome ругается на вставку) напечатать
   `разрешить вставку` / `allow pasting` → Enter.
4. Вставить содержимое `dist/trading-coach-inject.js` → Enter.
5. Появляется виджет «Trading Coach». Он берёт baseline из текущей истории и
   реагирует на сделки, которые ты закрываешь дальше. Раз в 5 сделок — полный
   AI-разбор со скорами.

> Виджет живёт в памяти страницы. Hard reload (F5) убирает его — просто вставь заново.

## Почему `module: "none"`

Исходник — один файл без `import`/`export`, обёрнутый в самозапускающийся IIFE.
`tsc` с `module: "none"` стирает типы/интерфейсы и выдаёт обычный скрипт, который
исполняется сразу при вставке в консоль и ничего не оставляет в глобальной области
страницы (всё живёт внутри замыкания). Бандлер не нужен — одна зависимость `typescript`.

## Что менять

- Тексты сообщений: массивы `LOSS` / `WIN`, функции `magW` / `magWW`, секции в `review()`.
- Каденция разбора: константа `REVIEW_EVERY` (сейчас 5).
- Цвета/стиль: объект `C` (палитра) и CSS в `box`/`pill`/`render`/`showReview`.
- Пороги риска: бэнды плеча в `detect()`, формулы скоров в `review()`.

Оригинальный рукописный JS (`../live-coach/trading-coach-inject.js`) оставлен как
есть — это два независимых артефакта с идентичным поведением.
