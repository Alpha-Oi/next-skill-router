# Analysis: nick-vels/skills vs SKILL-MANIFEST v0.2

**Source:** https://github.com/nick-vels/skills
**Analyzed:** 2026-09-21
**Method:** automated scan (see `scripts/analyze-nick-vels.mjs`)

---

## 1. Сводка

| Метрика | Значение |
| :--- | ---: |
| Всего SKILL.md | 1 |
| С YAML frontmatter | 1 |
| Без frontmatter | 0 |
| Отдельных manifest-файлов | 0 |
| Всего .md файлов | 21 |

## 2. Список навыков

| # | Директория | Frontmatter | Heading | Размер |
| ---: | :--- | :---: | :--- | ---: |
| 1 | `autopilot` | ✅ | Autopilot | 17856 |

## 3. Используемые поля frontmatter

| Поле | Использований | Наш аналог |
| :--- | ---: | :--- |
| `name` | 1 | name |
| `description` | 1 | description |
| `argument-hint` | 1 | (нет аналога — кандидат в v0.3) |

## 4. Сравнение форматов

**nick-vels/skills:** использует YAML frontmatter в SKILL.md

**next-skill-router:** SKILL-MANIFEST v0.2 — опциональный YAML frontmatter или отдельный `skill.manifest.yaml`.

## 5. Что у них есть, чего нет у нас

Поля, отсутствующие в нашем манифесте:

- `argument-hint` — кандидат на добавление в v0.3

## 6. Что у нас есть, чего нет у них

Поля в SKILL-MANIFEST v0.2, которых нет у nick-vels/skills:

- `model_affinity`
- `safety_profile`
- `execution_mode`
- `constraints`
- `cost_tier`
- `estimated_tokens`

## 7. Рекомендации

_Заполняется вручную после просмотра отчёта._

Кандидаты (на основе автоматического анализа выше):

1. Рассмотреть добавление 1 полей из nick-vels/skills в SKILL-MANIFEST v0.3.
2. Проверить, есть ли в репо паттерны композиции навыков (для Phase 4 Composer).
3. Оценить качество описаний intents — можно ли улучшить наш fallback-парсер.
4. Открыть Issues в нашем репо по каждой найденной полезной идее.

---

## 8. Приложение: полный список полей

- `name` (1)
- `description` (1)
- `argument-hint` (1)
