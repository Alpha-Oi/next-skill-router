# next-skill-router

> Универсальный маршрутизатор навыков для Claude Code.
> Открытый стандарт метаданных, учёт стоимости, обучение на обратной связи,
> динамическая композиция и полная наблюдаемость.

**Статус:** design phase · [обсуждение стандарта](https://github.com/OWNER/next-skill-router/discussions)

## Что это

`next-skill-router` — открытый стандарт `SKILL-MANIFEST` и референсная
реализация роутера навыков для Claude Code. Закрывает 5 пробелов
существующих решений:

1. Единый стандарт метаданных навыков.
2. Cost-aware маршрутизация с бюджетом.
3. Обучение на выборе пользователя.
4. Динамическая композиция (DAG + синтез).
5. Наблюдаемость и объяснимость.

Полное описание — в `docs/architecture.md` и `spec/`.

## Roadmap

| Фаза | Статус |
| :--- | :--- |
| 0. Спека | 🚧 in progress |
| 1. Core MVP | ⏳ planned |
| 2. Cost-aware | ⏳ planned |
| 3. Feedback loop | ⏳ planned |
| 4. Composer | ⏳ planned |
| 5. Telemetry + UI | ⏳ planned |
| 6. Экосистема | ⏳ planned |

## Участие

Обсуждения — в [Discussions](https://github.com/OWNER/next-skill-router/discussions).
Перед PR прочитайте `CONTRIBUTING.md`.

## Лицензия

Код — MIT, спецификация — CC-BY-4.0.
