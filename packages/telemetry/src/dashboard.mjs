/**
 * Рендерит self-contained HTML дашборд.
 * Читает dashboard-template.html и подставляет JSON-данные в __DATA__.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, 'dashboard-template.html');

export async function renderDashboard(metrics, spans) {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const data = JSON.stringify({ metrics, spans_sample: spans.slice(-100) });
  return template.replace("__DATA__", data);
}
