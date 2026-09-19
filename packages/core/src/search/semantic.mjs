import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { embed, embedBatch, cosine } from './embedder.mjs';

const CACHE_DIR = join(homedir(), '.claude', 'skill-router', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'embeddings.json');

function sha1(str) {
  return createHash('sha1').update(str).digest('hex').slice(0, 16);
}

function skillText(skill) {
  return [
    skill.name,
    skill.description || '',
    (skill.intents || []).join(' '),
    (skill.language || []).join(' ')
  ].join(' | ');
}

async function loadCache() {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, model: 'Xenova/all-MiniLM-L6-v2', skills: {} };
  }
}

async function saveCache(cache) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache), 'utf8');
}

/**
 * Строит (или обновляет) эмбеддинги навыков. Кеш по SHA-1 текста навыка.
 */
export async function buildSemanticIndex(skills) {
  const cache = await loadCache();
  const toCompute = [];
  const toComputeKeys = [];

  for (const s of skills) {
    const text = skillText(s);
    const key = s.name + ':' + sha1(text);
    if (!cache.skills[key]) {
      toCompute.push(text);
      toComputeKeys.push(key);
    }
  }

  if (toCompute.length > 0) {
    console.log('  Computing ' + toCompute.length + ' embeddings (first run may take a minute)...');
    const vecs = await embedBatch(toCompute);
    for (let i = 0; i < toComputeKeys.length; i++) {
      cache.skills[toComputeKeys[i]] = vecs[i];
    }
    await saveCache(cache);
  }

  // Возвращаем массив {id, embedding}
  return skills.map((s) => {
    const key = s.name + ':' + sha1(skillText(s));
    return { name: s.name, embedding: cache.skills[key] };
  });
}

/**
 * Семантический поиск. Возвращает отсортированный список {name, score}.
 */
export async function semanticSearch(query, skillEmbeddings) {
  const q = await embed(query);
  return skillEmbeddings
    .map((s) => ({ name: s.name, score: cosine(q, s.embedding) }))
    .sort((a, b) => b.score - a.score);
}
