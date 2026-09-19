#!/usr/bin/env node
import { execSync } from 'node:child_process';

const queries = [
  'проверь мой код',
  'запустить тесты',
  'напиши коммит',
  'отрефактори этот модуль',
  'сделай API для юзеров'
];

for (const q of queries) {
  execSync('node packages/cli/bin/router.mjs search "' + q + '"', { stdio: 'inherit' });
}
