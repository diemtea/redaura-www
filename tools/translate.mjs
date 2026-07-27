#!/usr/bin/env node
/* Redaura auto-translation pipeline.
   English (landing/locales/en.json) is the only file a human edits.
   Run:  DEEPL_API_KEY=xxx node tools/translate.mjs          (translate new/changed keys)
         node tools/translate.mjs --force                    (retranslate everything)
   Uses DeepL when DEEPL_API_KEY is set; otherwise falls back to the Anthropic API
   (ANTHROPIC_API_KEY). Each generated file stores the English source it was
   translated from under "__source", so only added or edited keys are re-sent. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LOCALES = join(dirname(fileURLToPath(import.meta.url)), '..', 'landing', 'locales');
const FORCE = process.argv.includes('--force');

// 24 targets + en = 25 languages. label = native name (shown in the pickers).
const TARGETS = {
  nl: 'Nederlands', de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português',
  it: 'Italiano', pl: 'Polski', cs: 'Čeština', sk: 'Slovenčina', hu: 'Magyar',
  ro: 'Română', bg: 'Български', el: 'Ελληνικά', da: 'Dansk', sv: 'Svenska',
  nb: 'Norsk', fi: 'Suomi', et: 'Eesti', lv: 'Latviešu', lt: 'Lietuvių',
  sl: 'Slovenščina', tr: 'Türkçe', uk: 'Українська', ja: '日本語',
  ar: 'العربية', pap: 'Papiamento', zh: '中文', eu: 'Euskara', ca: 'Català',
};
const DEEPL_CODE = { nb: 'NB', pt: 'PT-PT' }; // codes DeepL spells differently

const en = JSON.parse(readFileSync(join(LOCALES, 'en.json'), 'utf8'));

async function deepl(texts, lang) {
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, source_lang: 'EN', target_lang: (DEEPL_CODE[lang] || lang).toUpperCase(), tag_handling: 'html' }),
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  return (await res.json()).translations.map((x) => x.text);
}

async function claude(texts, lang) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 4096,
      messages: [{ role: 'user', content:
        `Translate this JSON array of UI strings from English to ${TARGETS[lang]} (${lang}) for a harm-reduction alert platform. ` +
        `Keep HTML tags, the Redaura brand name, and fictional org names (CheckPoint Network, Vanguard Testing, Aura Harm Reduction) untranslated. ` +
        `Reply with ONLY the translated JSON array.\n${JSON.stringify(texts)}` }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return JSON.parse((await res.json()).content[0].text);
}

const translate = process.env.DEEPL_API_KEY ? deepl : claude;
if (!process.env.DEEPL_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  console.error('Set DEEPL_API_KEY or ANTHROPIC_API_KEY.'); process.exit(1);
}

// flatten: array values (e.g. hero.words) become one item per index
const flat = [];
for (const [k, v] of Object.entries(en)) {
  if (Array.isArray(v)) v.forEach((s, i) => flat.push([`${k}[${i}]`, s]));
  else flat.push([k, v]);
}

for (const lang of Object.keys(TARGETS)) {
  const file = join(LOCALES, `${lang}.json`);
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const source = existing.__source || {};
  const stale = flat.filter(([k, s]) => FORCE || source[k] !== s);
  if (!stale.length) { console.log(`${lang}: up to date`); continue; }

  const out = await translate(stale.map(([, s]) => s), lang);
  const dict = { ...existing };
  stale.forEach(([k], i) => {
    const m = k.match(/^(.*)\[(\d+)\]$/);
    if (m) { (dict[m[1]] = dict[m[1]] || [])[+m[2]] = out[i]; }
    else dict[k] = out[i];
    source[k] = flat.find(([fk]) => fk === k)[1];
  });
  // drop keys deleted from English
  for (const k of Object.keys(dict)) if (k !== '__source' && !(k in en)) delete dict[k];
  dict.__source = source;
  writeFileSync(file, JSON.stringify(dict, null, 2) + '\n');
  console.log(`${lang}: translated ${stale.length} strings`);
}

const manifest = [{ code: 'en', label: 'English' },
  ...Object.entries(TARGETS)
    .map(([code, label]) => ({ code, label }))
    .filter((l) => l.code !== 'en' && existsSync(join(LOCALES, `${l.code}.json`)))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'))];
writeFileSync(join(LOCALES, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest: ${manifest.length} languages`);
