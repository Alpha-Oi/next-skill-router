# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS base

# System deps: git для клонирования навыков (если надо)
RUN apk add --no-cache git python3 make g++

WORKDIR /app

# Зависимости (кэшируются отдельно)
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts && \
    npm rebuild @xenova/transformers --foreground-scripts || true

# Код проекта
COPY packages ./packages
COPY integrations ./integrations
COPY spec ./spec
COPY docs ./docs
COPY tests ./tests
COPY scripts ./scripts
COPY README.md LICENSE .gitattributes ./

# Точка входа — CLI
RUN ln -s /app/packages/cli/bin/router.mjs /usr/local/bin/next-skill-router && \
    chmod +x /app/packages/cli/bin/router.mjs

# Volume для ~/.claude/skills и telemetry
VOLUME ["/root/.claude"]

ENV NODE_ENV=production

ENTRYPOINT ["node", "/app/packages/cli/bin/router.mjs"]
CMD ["--help"]
