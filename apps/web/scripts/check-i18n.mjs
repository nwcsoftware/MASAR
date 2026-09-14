/**
 * CI guard: en.json and ar.json must carry the same keys.
 * CLAUDE.md — "add the key to both en.json and ar.json in the same commit".
 *
 * i18next plural suffixes are normalised away, because English uses
 * _one/_other while Arabic legitimately uses _zero/_one/_two/_few/_many/_other.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function load(lang) {
  const path = resolve(here, '..', 'src', 'i18n', `${lang}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function flatten(value, prefix = '', out = new Set()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, path, out);
    } else {
      out.add(path.replace(PLURAL_SUFFIX, ''));
    }
  }
  return out;
}

const en = flatten(load('en'));
const ar = flatten(load('ar'));

const missingInAr = [...en].filter((key) => !ar.has(key)).sort();
const missingInEn = [...ar].filter((key) => !en.has(key)).sort();

if (missingInAr.length || missingInEn.length) {
  if (missingInAr.length) {
    console.error(`\nMissing in ar.json (${missingInAr.length}):`);
    for (const key of missingInAr) console.error(`  - ${key}`);
  }
  if (missingInEn.length) {
    console.error(`\nMissing in en.json (${missingInEn.length}):`);
    for (const key of missingInEn) console.error(`  - ${key}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`i18n OK — ${en.size} keys present in both en and ar.`);
