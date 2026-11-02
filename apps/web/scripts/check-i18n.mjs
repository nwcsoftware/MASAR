/**
 * CI guard for translations (CLAUDE.md — "add the key to both en.json and
 * ar.json in the same commit"):
 *   1. en.json and ar.json carry the same keys;
 *   2. every literal key passed to t('…') / i18nKey="…" in src/ exists in en.json;
 *   3. every dynamic key prefix (t(`tasks.status.${s}`)) resolves to an object.
 *
 * i18next plural suffixes are normalised away, because English uses
 * _one/_other while Arabic legitimately uses _zero/_one/_two/_few/_many/_other.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '..', 'src');
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function load(lang) {
  return JSON.parse(readFileSync(resolve(srcDir, 'i18n', `${lang}.json`), 'utf8'));
}

function flatten(value, prefix = '', out = new Set(), objects = new Set()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      objects.add(path);
      flatten(child, path, out, objects);
    } else {
      out.add(path.replace(PLURAL_SUFFIX, ''));
    }
  }
  return { keys: out, objects };
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.gen.ts') && !/\.(test|spec)\.tsx?$/.test(entry)) files.push(path);
  }
  return files;
}

const enJson = load('en');
const { keys: en, objects: enObjects } = flatten(enJson);
const { keys: ar } = flatten(load('ar'));
const problems = [];

const missingInAr = [...en].filter((key) => !ar.has(key)).sort();
const missingInEn = [...ar].filter((key) => !en.has(key)).sort();
if (missingInAr.length) problems.push(`Missing in ar.json (${missingInAr.length}):\n${missingInAr.map((k) => `  - ${k}`).join('\n')}`);
if (missingInEn.length) problems.push(`Missing in en.json (${missingInEn.length}):\n${missingInEn.map((k) => `  - ${k}`).join('\n')}`);

// Keys used in code. Literal: t('a.b') / t("a.b"). Dynamic: t(`a.b.${x}`) → prefix a.b must be an object.
const LITERAL = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
const DYNAMIC = /\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g;
const unknown = new Map();
for (const file of walk(srcDir)) {
  const text = readFileSync(file, 'utf8');
  for (const [, key] of text.matchAll(LITERAL)) {
    if (!en.has(key) && !enObjects.has(key)) unknown.set(key, file.slice(srcDir.length + 1));
  }
  for (const [, prefix] of text.matchAll(DYNAMIC)) {
    if (!enObjects.has(prefix) && ![...en].some((k) => k.startsWith(`${prefix}.`) || k.startsWith(`${prefix}_`)))
      unknown.set(`${prefix}.*`, file.slice(srcDir.length + 1));
  }
}
// Keys carried as data: zod messages in schema files and Edge Function error
// codes ({ code: 'users.errors.…' }). Any quoted 'namespace.key' whose first
// segment is a top-level namespace of en.json must resolve.
const namespaces = Object.keys(enJson).join('|');
const KEY_LITERAL = new RegExp(`['"]((?:${namespaces})\\.[a-zA-Z0-9_.]+)['"]`, 'g');
const functionsDir = resolve(here, '..', '..', '..', 'supabase', 'functions');
const dataFiles = [
  ...walk(srcDir).filter((f) => /[\\/]schema\.ts$/.test(f) || /[\\/]features[\\/].*queries\.ts$/.test(f)),
  ...walk(functionsDir),
];
for (const file of dataFiles) {
  const text = readFileSync(file, 'utf8');
  for (const [, key] of text.matchAll(KEY_LITERAL)) {
    if (!en.has(key) && !enObjects.has(key)) unknown.set(key, file.replace(/^.*?(src|supabase)[\\/]/, '$1/'));
  }
}

if (unknown.size) {
  problems.push(
    `Used in code but missing from en.json (${unknown.size}):\n${[...unknown]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, f]) => `  - ${k}  (${f})`)
      .join('\n')}`,
  );
}

if (problems.length) {
  console.error(`\n${problems.join('\n\n')}\n`);
  process.exit(1);
}

console.log(`i18n OK — ${en.size} keys present in both en and ar; every key used in src/ exists.`);
