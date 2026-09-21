/**
 * Redactor: заменяет найденные секреты на [REDACTED:VAR_NAME].
 * Вызывается ДО записи текста в файл, лог или кеш.
 *
 * Правила (см. SKILL-MANIFEST v0.3.1 → secrets_policy):
 *   1. Никогда не запрашивать секрет.
 *   2. Редакция at ingest — до любой записи.
 *   3. "Verbatim" = "verbatim after redaction".
 */

/**
 * Паттерны типичных секретов. Порядок важен — специфичные первыми.
 */
const PATTERNS = [
  // OpenAI / Anthropic
  { name: 'OPENAI_API_KEY', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'ANTHROPIC_API_KEY', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  // GitHub
  { name: 'GITHUB_TOKEN', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: 'GITHUB_PAT', re: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g },
  // AWS
  { name: 'AWS_ACCESS_KEY_ID', re: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: 'AWS_SECRET_ACCESS_KEY', re: /(?<=aws_secret_access_key\s*[=:]\s*)[A-Za-z0-9/+=]{40}/gi },
  // Google
  { name: 'GOOGLE_API_KEY', re: /\bAIza[A-Za-z0-9_-]{35}\b/g },
  // Slack
  { name: 'SLACK_TOKEN', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  // Stripe
  { name: 'STRIPE_SECRET_KEY', re: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { name: 'STRIPE_PUBLISHABLE_KEY', re: /\bpk_live_[A-Za-z0-9]{20,}\b/g },
  // JWT
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  // PEM-блоки
  { name: 'PRIVATE_KEY', re: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g }
];

/**
 * Возвращает { text, redacted } — текст после редакции и количество замен.
 */
export function redact(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { text: text, redacted: 0 };
  }

  let count = 0;
  let result = text;

  for (const { name, re } of PATTERNS) {
    result = result.replace(re, () => {
      count++;
      return '[REDACTED:' + name + ']';
    });
  }

  return { text: result, redacted: count };
}

/**
 * Редакция с предупреждением в console (для ingest-pipeline).
 */
export function redactWithWarning(text, context = '') {
  const r = redact(text);
  if (r.redacted > 0) {
    console.warn('  [secrets] redacted ' + r.redacted + ' value(s)' + (context ? ' in ' + context : ''));
  }
  return r;
}

/**
 * Быстрая проверка — есть ли секреты в тексте.
 */
export function containsSecrets(text) {
  return PATTERNS.some((p) => p.re.test(text));
}
