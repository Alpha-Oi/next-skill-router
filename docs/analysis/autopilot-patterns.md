# Autopilot: архитектурные паттерны для next-skill-router

**Источник:** [nick-vels/skills → autopilot](https://github.com/nick-vels/skills)
**Анализ:** [autopilot-deep-dive.md](./autopilot-deep-dive.md)
**Статус:** анализ завершён, паттерны к внедрению

---

## Зачем этот документ

Autopilot — не «ещё один навык», а мастер-класс по архитектуре агентов.
Ниже — 5 паттернов, которые стоит перенести в наш проект, с обоснованием,
приоритетом и целевой фазой.

---

## Паттерн 1. Read-at-phase-start (lazy loading)

### Что делает autopilot

17 файлов `phases/*.md` **не загружаются сразу**. Каждый открывается **в момент
старта соответствующей фазы**. Контекст остаётся маленьким на каждом шаге.

> *"The unit of loading is the file, not the section — a read pulls in the whole
> thing, which is why anything one phase needs and another does not is its own file."*

### Почему это важно для нас

Наш роутер грузит все 47 навыков в память **на каждом запросе**. При 200+ это
станет проблемой: latency, память, стоимость embedding-вычислений.

### Что делать

Создать `packages/core/src/router/lazy-loader.mjs`:

1. Лёгкая фаза — загрузить только `name` + `description` + эмбеддинг (это уже кешируется).
2. Тяжёлая фаза — загрузить полный SKILL.md только для **топ-N кандидатов**.

```javascript
// Псевдокод
const lightIndex = await loadLightIndex();          // name + desc + embed
const candidates = await search(query, lightIndex); // топ-20
const full = await loadFull(candidates.slice(0,5)); // полные SKILL.md
```

**Метрика успеха:** latency маршрутизации при 200 навыках ≤ 100 мс (сейчас
уже 47 навыков, но лёгкое сканирование растёт линейно).

### Приоритет

🔴 **Высокий** — закладываем в Phase 2.5 (cost-aware).

---

## Паттерн 2. Gates — формальная модель проверок

### Что делает autopilot

4 gate между фазами, каждый с явным условием прохождения:

| Gate | Фаза | Условие |
| :--- | :--- | :--- |
| G1 | Briefing | каждое требование имеет статус |
| G2 | Spec | **blind acceptance**: независимый читатель с брифом и спекой не находит пропусков |
| G3 | Plan | каждый `in-spec` маппится на ≥1 таск, и каждый таск трассируется назад |
| G4 | Final | blind acceptance в самом конце, без спеки |

**G2 и G4 — одна проверка на двух концах полёта.** Обе нужны.

### Почему это важно для нас

У нас есть `safety_profile` с флагами, но **нет процедурной модели**. Gates
превращают «мягкие рекомендации» в **жёсткие чек-поинты**.

### Что делать

Добавить в `SKILL-MANIFEST v0.3.1`:

```yaml
gates:
  pre:
    - dependencies_installed
    - git_clean
  post:
    - tests_pass
    - no_secrets_in_diff
  blind_acceptance: true
```

В `ROUTER-PROTOCOL` добавить поле `gates` в каждый шаг `plan[]`.

В коде — `packages/core/src/gates/checker.mjs`:
- проверяет pre перед стартом,
- проверяет post после,
- логирует провал как safety_event.

### Приоритет

🟡 **Средний** — патч v0.3.1, но не блокирует Phase 2.5.

---

## Паттерн 3. Secrets как процедура, не как флаг

### Что делает autopilot

Секреты — **отдельный слой**, не поле в frontmatter:

1. **Never request one.** Никакой ключ, токен, пароль никогда не является вопросом.
2. **Redact at ingest, before anything is written.** Секрет, попавший в бриф или ответ пользователя, превращается в `[REDACTED:VAR_NAME]` **до** записи в файл.
3. **"Verbatim" = "verbatim after redaction".**
4. **Refer to it by name.** `STRIPE_SECRET_KEY`, не значение.
5. **Leaked secret = stop condition.** Немедленный отчёт, совет ротировать ключ.

### Почему это важно для нас

Мы храним `feedback.jsonl` и `embeddings.json` локально. Если пользователь вставит
в запрос API-ключ, мы его закешируем. Это утечка.

### Что делать

`packages/core/src/secrets/redactor.mjs`:
- regex для типичных паттернов (sk-..., ghp_..., AKIA..., etc.)
- функция `redactBeforeStore(text)`
- вызов в `route()` **перед** записью в feedback/embeddings.

`SKILL-MANIFEST v0.3.1`:
```yaml
secrets_policy:
  never_request: true
  redact_at_ingest: true
  allowed_env_vars: [STRIPE_KEY, OPENAI_KEY]
```

### Приоритет

🔴 **Высокий** — safety-фича, делаем в Phase 2.6.

---

## Паттерн 4. Пять непреложных правил

Autopilot определяет **5 правил, которые не подлежат нарушению** ни в каком режиме:

1. Требование удаляется **только пользователем** (в его словах).
2. Секрет никогда не запрашивается/эхо/записывается.
3. Факты о пользователе **не выдумываются**.
4. Необратимые действия — **это вопрос**.
5. **Оркестратор не пишет код проекта** — только субагенты.

### Почему это важно для нас

Правило 5 — архитектурное. Оно защищает от «дрейфа ответственности»: роутер
не может сам начать исполнять навык, он только **планирует**.

### Что делать

Добавить раздел в `docs/architecture.md`:

**Non-negotiable rules:**
1. Router никогда не исполняет — только маршрутизирует.
2. Требование из запроса пользователя не может быть отброшено молча.
3. Секреты не пишутся в кеш/логи/feedback.
4. Необратимые действия требуют подтверждения.
5. Local-first: если `require_local_only`, никаких сетевых вызовов.

В `ROUTER-PROTOCOL` — поле `executor: router | subagent | composer` в `plan[]`.

### Приоритет

🟢 **Средний** — политика, не код. Задокументировать в Phase 2.5.

---

## Паттерн 5. Rationalizations catalogue

### Что делает autopilot

`phases/rationalizations.md` — каталог **оправданий** и **красных флагов**.
Читается в трёх случаях:
- при провале gate,
- при ловле себя на оправдании,
- **один раз перед финальным отчётом.**

> *"A catalogue is opened, not remembered."*

### Почему это важно для нас

У нас есть `--explain`, но он **описывает** выбор, а не **проверяет** его. Rationalizations
— self-check: не оправдываем ли мы выбор по нерелевантным причинам?

### Что делать

`packages/core/src/router/rationalizations.json` — каталог типичных ошибок:

```json
{
  "patterns": [
    {
      "id": "similar-name-not-relevance",
      "match": "навык выбран потому что имя похоже, а не потому что метаданные совпали",
      "action": "понизить score на 0.2 и записать warning"
    },
    {
      "id": "high-score-low-prereqs",
      "match": "top-1 имеет prereq missing, но всё равно выбран",
      "action": "блокировать auto-invoke"
    }
  ]
}
```

В `route()` — вызов `selfCheck(candidates)` **перед** выдачей.

### Приоритет

🟡 **Средний** — Phase 4 (Composer), вместе с blind acceptance.

---

## Сводная таблица

| # | Паттерн | Приоритет | Фаза | Файлы |
| ---: | :--- | :---: | :--- | :--- |
| 1 | Lazy loading | 🔴 | 2.5 | `router/lazy-loader.mjs` |
| 2 | Gates | 🟡 | 2.6 | `gates/checker.mjs`, spec v0.3.1 |
| 3 | Secrets redactor | 🔴 | 2.6 | `secrets/redactor.mjs` |
| 4 | 5 non-negotiable rules | 🟢 | 2.5 | `docs/architecture.md` |
| 5 | Rationalizations | 🟡 | 4 | `router/rationalizations.json` |

---

## Что НЕ берём у autopilot

- **17 файлов phases/** — это разумно для одного большого навыка, но не для роутера.
- **Три dials** (mode/depth/polish) — специфично для build-процесса, не для маршрутизации.
- **Russian stage names** — у нас всё на английском.

---

## Ссылки

- [autopilot-deep-dive.md](./autopilot-deep-dive.md) — детальный анализ
- [nick-vels-skills.md](./nick-vels-skills.md) — первый сканирующий отчёт
- [SKILL-MANIFEST.md](../../spec/SKILL-MANIFEST.md) — наша спецификация
