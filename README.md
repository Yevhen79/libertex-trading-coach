# Guardian Angel → Libertex «Trading Buddy» (Hackathon)

Проект внутреннего Хакатона Libertex: собственная версия поведенческого AI-коуча в терминале
(референс — CPattern Guardian Angel, демо от 22–23.02.2026).

## Структура
- [`research/01-deep-research.md`](research/01-deep-research.md) — что это, вендор CPattern, кто использует (AvaTrade, Capital.com, NSFX, Leverate), механика, все метрики эффекта, конкуренты.
- [`draft/02-libertex-guardian-angel-spec.md`](draft/02-libertex-guardian-angel-spec.md) — продуктовый драфт под Libertex: тексты уведомлений, LLM-промпт и пример AI-Review, комплаенс, гейминг, scope Хакатона, KPI.
- [`draft/prototype/trading-buddy-prototype.html`](draft/prototype/trading-buddy-prototype.html) — **десктоп-прототип** виджета в терминале (10 сделок, AI-разбор, RU/EN).
- [`draft/prototype/trading-buddy-mobile-libertex.html`](draft/prototype/trading-buddy-mobile-libertex.html) — **мобильный прототип в официальном дизайне Libertex** (Facelift 2). Основной deliverable. Токены и шрифты (Inter/Roboto) **сверены с Figma DSL 2.0 через MCP** (палитра, glass, Badge — точные значения).
- [`draft/prototype/trading-buddy-mobile.html`](draft/prototype/trading-buddy-mobile.html) — ранняя мобильная версия (teal, до применения DESIGN.md).
- [`live-coach/`](live-coach/) — **живой коуч**: инжект-скрипт, работающий прямо в терминале Libertex и реагирующий на реальные сделки в реальном времени (v2.2 — с учётом плеча, % от депозита, margin-call; разбор 10 сделок в стиле Guardian Angel).
- [`real-data/`](real-data/) — прогон движка на реальных данных счёта: метрики + разбор реального и демо-счёта. Личные данные (ФИО, баланс, № счёта) замаскированы; репозиторий приватный.
- `reference/` — 6 скриншотов исходного демо CPattern для Libertex.

## Суть в 3 строках
Встроенный в терминал коуч показывает трейдеру зеркало его **привычек** (не рынка):
после сделки — короткий фидбэк, раз в 10 сделок — AI-разбор с оценками.
Бьёт в **ретеншн + оборот + депозиты** (бенчмарк CPattern: депозиты +42%, сделки +19%, доп. депозиты 53% vs 41%). Комплаенс-safe: не даёт торговых советов.
