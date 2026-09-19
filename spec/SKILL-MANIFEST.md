# SKILL-MANIFEST v0.1 (Draft RFC)

**Статус:** Draft · **Обсуждение:** Discussions → категория "General"

Опциональный файл метаданных рядом с `SKILL.md`.
Полная версия — см. историю обсуждения в Discussions.

## Схема (кратко)

| Поле | Тип | Обязательно |
| :--- | :--- | :---: |
| name | string | ✅ |
| version | string (SemVer) | ✅ |
| description | string | ✅ |
| intents | string[] | ➖ |
| prerequisites.files | string[] | ➖ |
| prerequisites.tools | string[] | ➖ |
| complexity | low/medium/high | ➖ |
| estimated_tokens | number | ➖ |
| cost_tier | cheap/standard/premium | ➖ |
| composable_with | string[] | ➖ |
| conflicts_with | string[] | ➖ |
| never_auto_invoke | boolean | ➖ |
| language | string[] | ➖ |

Роутер **обязан** работать без манифеста (fallback на SKILL.md).
