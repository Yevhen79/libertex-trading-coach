# Guardian Angel — Deep Research

> Референс-фича из демо CPattern для Libertex (файл `Guardian Angel demo for Libertex (5).docx` — 6 скриншотов Google Meet, презентовал **Oded Shefer, CPattern**).
> Цель research: понять, что это, у кого встречается, как устроено, и какой продуктовый эффект даёт (ретеншн / оборот / депозиты) — для сборки собственной версии на внутреннем Хакатоне Libertex.

---

## 1. Что это такое (в одном абзаце)

**Guardian Angel** — это встроенный в торговый терминал **поведенческий AI-коуч** для трейдера. Он не даёт торговых сигналов («покупай/продавай»), а в реальном времени анализирует **поведение** трейдера (его собственные сделки) и после каждой сделки выдаёт короткий персональный фидбэк, а периодически — развёрнутый «AI Trading Review» с оценками и разбором привычек. Работает на когнитивно-психологической механике: **подкрепляет позитивное поведение и переформулирует (reframe) негативные исходы**, чтобы трейдер не паниковал, не сливал депозит и торговал дисциплинированнее.

Ключевая мысль для нас: это **retention/monetization-инструмент, замаскированный под заботу о трейдере**. Он повышает не «прибыльность клиента для клиента», а **вовлечённость, доверие и объёмы** — то есть напрямую бьёт в LTV брокера.

---

## 2. Кто это делает и кто уже использует

| Игрок | Роль | Комментарий |
|---|---|---|
| **CPattern** (cpattern.com) | Вендор-разработчик | Израильский fintech. Продаёт Guardian Angel брокерам как SaaS-плагин. Внедрение 2–4 рабочих дня, без ручной работы после. Presenter в демо — Oded Shefer (CPattern). |
| **AvaTrade** | Крупнейший клиент | GA встроен как EA в их MT4/MT5. Публично хвалят: «прямая позитивная связь с торговой активностью», высокий adoption, «трейдеры чувствуют контроль и растёт доверие к бренду». Демо для Libertex было именно на терминале AvaTrade. |
| **Capital.com** | Использует | Предлагает «Guardian Angels» через MT4. |
| **Leverate** | Дистрибуция | Договорились предлагать GA от CPattern своим брокерам-клиентам (white-label). |
| **NSFX** | Использует | GA в списке инструментов. |
| **Autochartist** | Интеграция-партнёр | Встроил свою автоаналитику паттернов внутрь Guardian Angel — GA стал каналом доставки и поведенческого фидбэка, и рыночных идей. |

**Вывод:** это уже проверенная, коммерциализированная категория в CFD/forex-индустрии, а не эксперимент. Для Libertex вопрос стоит как **build vs buy**: лицензировать CPattern или собрать своё (что и есть смысл Хакатона — на Claude Code-velocity собрать MVP за дни).

---

## 3. Как это устроено — механика

### 3.1. Два слоя фидбэка

**Слой A — мгновенные пост-трейд уведомления (виджет «Guardian Angel»).**
Маленькое всплывающее окно после **открытия и закрытия** каждой сделки. Персонализировано **собственной статистикой трейдера**. Примеры из демо (дословно):

> **BTC/USD** — «Ouch! You lost 103.0 USD in this trade, 24.5 USD more than your average loss (78.5 USD). *AI Review: Your AI review will be available for you in 4 more trades.*»

> **EUR/USD** — «Good work! Your net profit here was 28.0 USD. Remember that your average profit is higher (31.5 USD). *AI Review: Your AI review is ready! Click here for the AI review.*»

Элементы виджета: навигация по сделкам (`< 4 of 10 >`), шестерёнка настроек, кнопки 👍/👎, ссылки Tutorial / Feedback, иконки калькулятора и связи.

**Слой B — периодический «AI Trading Review» (LLM-отчёт по последним 10 сделкам).**
Разворачивается по клику. Структура из демо:

1. **Trading Style Profile** — «Вы swing-трейдер, ловите medium-term движения на ретрейсментах…»
2. **Trading Parameters Summary** — total trades, largest profit/loss, average profit/loss, average volume per trade, **% сделок со стоп-лоссом**, average/max/min длительность сделки.
3. **Performance Improvement or Deterioration** — стало лучше/хуже vs прошлые сделки, какой актив самый прибыльный.
4. **Risk-Taking Patterns** — уровень риска, использование плеча, наличие/отсутствие стопов.
5. **Handling of Greed and Fear** — как трейдер справляется с жадностью/страхом.
6. **Learning Curve and Progress** — прогресс, консистентность стратегии.
7. **Scores for Last 10 Trades** — оценки по шкале: **Consistency: 7, Discipline: 6, Rational Trading: 8**.
8. **«Please rate this AI report»** — ⭐⭐⭐⭐⭐ (сбор обратной связи для тюнинга).
9. Дисклеймер: *«AI can make mistakes. Check important info.»*

### 3.2. Какие поведенческие индикаторы мониторит

Индустриальные метрики поведения (не рыночные сигналы):
- **Использование стоп-лоссов** (есть ли SL, % сделок с SL).
- **Хеджирование** (практики хеджа).
- **Диверсификация инструментов** (не сидит ли всё в одном активе).
- **Соотношение размера сделки к свободной марже / плечо** → база для **раннего предупреждения о margin call**.
- Средний профит/лосс, длительность удержания, частота, стрик успехов/неудач.

### 3.3. Психологический движок

Опирается на когнитивную психологию:
- **Reinforcement** позитивного поведения («Good work!»).
- **Reframing** негатива («ты потерял, но твой средний профит выше — не всё потеряно»), чтобы **снизить панические выводы средств и revenge-trading**.
- **Ранние алерты риска** до margin call → трейдер чувствует, что брокер «на его стороне» → рост доверия.
- Адресует 4 барьера: управление эмоциями, когнитивная перегрузка, трудности обучения, провалы дисциплины стратегии.

### 3.4. Важно для комплаенса

CPattern **сознательно НЕ даёт рекомендаций по ордерам** («does not make suggestions about placing orders») — это удерживает продукт вне зоны инвестиционных советов и упрощает регуляторику. Персональные данные обрабатываются «вслепую» (blind data, без PII). **Для Libertex (CySEC и др.) это критично: фича должна оставаться "поведенческим зеркалом", а не советником.**

---

## 4. Продуктовый эффект — цифры (главное для монетизации)

### 4.1. Свежие данные (Finance Magnates, эксклюзив по данным брокера, выборка 2 190 пользователей)

| Метрика | GA-пользователи | Обычные | Дельта |
|---|---|---|---|
| **Средний депозит** | **$4 091** | $2 874 | **+42%** |
| **Кол-во сделок** | 180 | 152 | **+19%** |
| **Объём (лоты)** | 355 | 267 | **+33%** |
| **Объём ($)** | ~$1.2M | ~$902K | **+37%** |
| **Доля делающих доп. депозит** | **53%** | 41% | **+29% uplift** |

Концентрация выручки: **277 GA-юзеров (13% базы) дали 24% всей депозитной выручки** ($1.13M из $4.6M). Дополнительно **+$337 109/мес** относительно ожидаемого от эквивалентных не-юзеров.

### 4.2. Кейс CPattern × Autochartist (сравнение с 200+ аккаунтами того же брокера, 1 месяц)

- **+126.3%** частота торговли
- **+141.0%** торговые объёмы
- **+232%** средний депозит
- **+70%** доля реdepositing-клиентов

### 4.3. Ранние заявленные метрики (исторически, с осторожностью)

- Депозиты **+70%+**, объёмы **+70%+**, ретеншн **+15%** (ранние данные CPattern, к ним репортёр относился скептически — но направление совпадает со свежими).

### 4.4. Самооценка пользователей (survey)

- **95%** трейдеров сказали, что GA **повлиял на их торговые решения**.
- Оценка полезности для прибыльности: **4.6 / 5**.
- Из демо (январь, n=28): «After receiving feedback… I sometimes changed my [decision]» — **82.1% / 89.5%**; влияние на прибыльные сделки по 5-балльной шкале: **у активных юзеров GA — 4.79** против группового среднего 1.82.

> ⚠️ **Дисклеймер по цифрам:** это данные вендора/брокеров, выборки небольшие, causation ≠ correlation (GA чаще включают более вовлечённые трейдеры — self-selection). Но диапазон и повторяемость по нескольким источникам делают эффект правдоподобным. Для Хакатона: заявляем как «industry benchmarks», а свой эффект меряем A/B-тестом.

---

## 5. Конкурентный ландшафт (шире, чем CPattern)

| Категория | Игроки | Что делают | Отличие от GA |
|---|---|---|---|
| **Broker-embedded behavioral coach** | **CPattern Guardian Angel** (AvaTrade, Capital.com, NSFX, Leverate) | Именно то, что мы разбираем | Эталон категории |
| **AI-компаньон в брокер-терминале** | **eToro Tori** (на Grok) | NL-ассистент, объясняет стратегии, рыночные инсайты, снижает knowledge-asymmetry → ретеншн | Больше про «объяснение рынка», меньше про «зеркало твоего поведения» |
| **Трейд-журналы с AI** | **TradeZella** (Zella AI), **Edgewonk** (Tiltmeter, discipline score, геймификация «level up»), **Tradervue** | Авто-ревью сессий, тэги, поведенческие паттерны, стрики, дисциплина | Внешние SaaS, не встроены в брокера, платные для трейдера, ставят импорт из брокера. Рынок trade-management SW: $3.0B (2026) → $9.4B (2036), CAGR ~12%. |
| **Авто-теханализ / контент** | **Autochartist**, **Trading Central** | Паттерны, идеи, алерты волатильности | Про рынок, не про поведение; часто идут *внутри* GA как контент-слой |
| **Sentiment/поведенческие подсказки брокеров** | Plus500 (индикаторы толпы), IG (client sentiment) | Показывают позиционирование толпы | Не персональный коуч |

**Белое пятно / возможность для Libertex:** соединить (1) поведенческое зеркало по *собственным* сделкам + (2) reframing-эмпатию + (3) геймификацию (score/streak/level) + (4) нативную интеграцию в проприетарный терминал Libertex и мобильное приложение (а не только MT). Плюс — **уникальный угол Libertex**: комиссионная модель (нет спреда, фикс-комиссия) даёт честный, прозрачный расчёт P&L и «стоимости привычек» (например, «твои сделки без стопа стоили тебе X комиссий впустую»).

---

## 6. Что это значит для Libertex (короткое резюме перед драфтом)

- Категория **валидирована деньгами** у прямых конкурентов (AvaTrade, Capital.com).
- Эффект бьёт ровно в **три метрики, которые заказал Евгений**: ретеншн (доверие + меньше блоу-апов), оборот (+19–33% сделок/объёма), депозиты (+42%, доп. депозиты 53% vs 41%).
- Технически это **rules-engine + LLM-нарратив + виджет** — идеальный по размеру объект для Хакатона на Claude Code.
- Главный риск — **комплаенс** (не советник) и **честность метрик** (A/B, а не вера в маркетинг вендора).

Детальный продуктовый драфт с текстами и примерами → `../draft/02-libertex-guardian-angel-spec.md`.

---

## Источники

- [Guardian Angel — AvaTrade](https://www.avatrade.com/trading-platforms/metatrader-4/guardian-angel)
- [AvaTrade Expands Access to CPattern's Guardian Angel](https://www.avatrade.com/blog/pr/avatrade-expands-access-to-guardian-angel)
- [Trading "Guardian Angel" Boosts Broker Deposits by 42%, Data Shows — Finance Magnates](https://www.financemagnates.com/forex/analysis/exclusive-you-want-to-combat-cfd-client-churn-and-boost-deposits-by-40-check-out-this-tool/)
- [An Overview of the broker plugin: "Guardian Angel" — Finance Magnates](https://www.financemagnates.com/forex/technology/an-overview-of-the-broker-plugin-guardian-angel/)
- [Leverate to offer Guardian Angel by CPattern — Finance Magnates](https://www.financemagnates.com/forex/technology/leverate-offer-guardian-angel-cpattern-clients/)
- [CPattern — Trading made Personal](https://cpattern.com/)
- [Autochartist × CPattern Guardian Angel — интеграция и кейс](https://autochartist.com/platform-integration/unlock-enhanced-trader-engagement-with-autochartist-and-cpattern-in-guardian-angel/)
- [What are Guardian Angels — Capital.com Help](https://help.capitalccuk.com/hc/en-us/articles/13269192286482-What-are-Guardian-Angels-and-are-they-offered-through-MetaTrader4-MT4)
- [Guardian Angel — NSFX](https://nsfx.com/tools/guardian-angel/)
- [eToro Tori — Your AI Edge](https://www.etoro.com/trading/platforms/tori/)
- [TradeZella — AI Trading Partner & Trading Journal](https://www.tradezella.com/)
- [Edgewonk vs TradeZella](https://edgewonk.com/blog/the-best-tradezella-alternative-edgewonk-vs-tradezella)
