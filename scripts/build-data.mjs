#!/usr/bin/env node
/**
 * Нормализация выгрузки WooCommerce в data-слой сайта.
 * Вход:  ../wk-data/40a0a82a-catalog.json  (выгрузка от 30.08.2026)
 * Выход: src/data/catalog.json, src/data/redirects.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || '/home/claude/wk-data/40a0a82a-catalog.json';
const IMAGES = process.argv[3] || '/home/claude/wk-data/9b74747e-images.csv';

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));

/** Семейства изделий: конструктивные признаки, от которых зависит расчёт. */
const FAMILIES = {
  'ЗВП':  { island: false, supply: false, hydro: false, title: 'Зонты вытяжные пристенные' },
  'ЗВО':  { island: true,  supply: false, hydro: false, title: 'Зонты вытяжные островные' },
  'ЗПВП': { island: false, supply: true,  hydro: false, title: 'Зонты приточно-вытяжные пристенные' },
  'ЗПВО': { island: true,  supply: true,  hydro: false, title: 'Зонты приточно-вытяжные островные' },
  'ЗВПГ': { island: false, supply: false, hydro: true,  title: 'Зонты пристенные с гидрозатвором' },
  'ЗВОГ': { island: true,  supply: false, hydro: true,  title: 'Зонты островные с гидрозатвором' },
  'ПИР':  { island: false, supply: false, hydro: false, title: 'Зонты купольные «Пирамида»' },
  'ГФ':   { island: false, supply: false, hydro: true,  title: 'Гидрофильтры' },
  'АВТ':  { island: false, supply: false, hydro: true,  title: 'Автоматика для гидрофильтров' },
};

/** Артикул → семейство. У «Пирамиды», гидрофильтра и щита артикула в выгрузке нет. */
function familyOf(p) {
  const a = (p.article || '').toUpperCase();
  if (a.startsWith('ЗПВО')) return 'ЗПВО';
  if (a.startsWith('ЗПВП')) return 'ЗПВП';
  if (a.startsWith('ЗВОГ')) return 'ЗВОГ';
  if (a.startsWith('ЗВПГ')) return 'ЗВПГ';
  if (a.startsWith('ЗВО'))  return 'ЗВО';
  if (a.startsWith('ЗВП'))  return 'ЗВП';
  if (/пирамида/i.test(p.name)) return 'ПИР';
  if (/^гидрофильтр$/i.test(p.name.trim())) return 'ГФ';
  if (/щит управления/i.test(p.name)) return 'АВТ';
  return null;
}

/** «450/1200/600 мм» → { h, w, d } */
function parseSize(s) {
  const m = String(s || '').match(/(\d{2,4})\s*[\/×x]\s*(\d{2,4})\s*[\/×x]\s*(\d{2,4})/);
  return m ? { h: +m[1], w: +m[2], d: +m[3] } : null;
}

function typeOf(name) {
  const m = name.match(/ТИП\s*(\d)/i);
  return m ? `ТИП ${m[1]}` : null;
}

function slugOf(p) {
  return p.slug;
}

/**
 * Чистим короткое описание: список опций, промокод и оговорка про оферту
 * выводятся на сайте отдельными блоками, в тексте они дублируются.
 */
function cleanShort(text) {
  return String(text || '')
    .replace(/Вытяжные зонты по желанию заказчика[\s\S]*$/i, '')
    .replace(/Скидка\s*10\s*%[\s\S]*$/i, '')
    .replace(/Стоимость товара носит[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* --- изображения --- */
const images = {};
if (fs.existsSync(IMAGES)) {
  const lines = fs.readFileSync(IMAGES, 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const id = cols[0], url = cols[4];
    if (!id || !url) continue;
    (images[id] ||= []).push(url);
  }
}

const OPTIONS = [
  { key: 'врезка',      name: 'Врезка присоединительная', price: null },
  { key: 'проушины',    name: 'Проушины для монтажа',     price: null },
  { key: 'кран',        name: 'Кран для слива жира и конденсата', price: null },
  { key: 'светильники', name: 'Точечные светодиодные светильники', price: null },
];


/**
 * Редакторские правки текстов и локальные фото.
 *
 * Тексты старого сайта приходят из выгрузки одним абзацем: списки схлопнуты
 * в строку, местами есть формулировки не для клиента («защита от дурака»).
 * Здесь они переписаны и разложены на поля, а то, что вынесено на сайт
 * отдельными блоками (сравнение гидрозонта с гидрофильтром, режимы щита),
 * из описания убрано, чтобы не дублировалось на одной странице.
 *
 * Правки живут здесь, а не в catalog.json, — иначе следующий `npm run data`
 * их сотрёт.
 */
const EDITORIAL = {
  'ЗВПГ': {
    description:
      'Зонт с гидрозатвором предотвращает возгорание в вытяжной системе: гасит искру, ' +
      'снимает жир и сажу, убирает запах и охлаждает поток — всё это внутри самого зонта, ' +
      'на источнике.',
  },
  'ЗВОГ': {
    description:
      'Островное исполнение зонта с гидрозатвором: захват по всему периметру, подвес на ' +
      'потолок. Искрогашение, снятие жира и сажи и охлаждение потока происходят внутри ' +
      'зонта, до входа в воздуховод.',
  },
  'ГФ': {
    short:
      'Гидрофильтр очищает воздух и не даёт огню попасть в вентиляционную систему. ' +
      'Сначала водяная завеса охлаждает поток и гасит искру, затем в фильтрах идёт ' +
      'механическая очистка.',
    features: [
      'Искрогашение',
      'Удаление жиров и сажи',
      'Удаление запахов',
      'Охлаждение воздуха',
    ],
  },
  'АВТ': {
    short:
      'Щит управления и диспетчеризации для зонтов с гидрозатвором и гидрофильтров. ' +
      'Контролирует давление воды и температуру продуктов горения и не даёт продолжить ' +
      'работу при неисправности — то, чем закрывается требование п. 5.30 СП 7.13130.2013.',
    description: '',
  },
  'ПИР': {
    short:
      'Цена указана за купольный зонт «Пирамида» без жироуловителей, размером 400/600/600 мм. ' +
      'Купольные зонты применяются в основном над открытым огнём — мангалами и печами.',
    features: [
      'Пристенное исполнение — можно дополнить лабиринтными фильтрами (жироуловителями)',
      'Островное исполнение — установку фильтров конструкция не предусматривает',
    ],
  },
};

/** Локальные фото в public/. Внешние адреса старого сайта на новом не используем. */
/** Локальные фото в public/catalog — порт с wentkompany.ru, порядок как на карточках. */
const LOCAL_IMAGES = {
  'АВТ': ['/catalog/avt-1.webp', '/catalog/avt-2.webp'],
  'ГФ': ['/catalog/gf-1.webp', '/catalog/gf-2.webp', '/catalog/gf-3.webp'],
  'ЗВОГ': ['/catalog/zvog-1.webp', '/catalog/zvog-2.webp', '/catalog/zvog-3.webp'],
  'ЗВО-1': ['/catalog/zvo-1.webp'],
  'ЗВО-2': ['/catalog/zvo-2.webp'],
  'ЗВО-3': ['/catalog/zvo-3.webp'],
  'ЗВПГ': ['/catalog/zvpg-1.webp', '/catalog/zvpg-2.webp', '/catalog/zvpg-3.webp'],
  'ЗВП-1': ['/catalog/zvp-1.webp'],
  'ЗВП-2': ['/catalog/zvp-2.webp'],
  'ЗВП-3': ['/catalog/zvp-3.webp'],
  'ЗПВО-1': ['/catalog/zpvo-1.webp'],
  'ЗПВО-2': ['/catalog/zpvo-2.webp'],
  'ЗПВО-3': ['/catalog/zpvo-3.webp'],
  'ЗПВП-1': ['/catalog/zpvp-1.webp'],
  'ЗПВП-2': ['/catalog/zpvp-2.webp'],
  'ЗПВП-3': ['/catalog/zpvp-3.webp'],
  'ПИР': ['/catalog/pir.webp'],
};

const products = [];
for (const p of raw.products) {
  const family = familyOf(p);
  if (!family) continue; // нейтральное оборудование в каталог нового сайта не идёт
  const size = parseSize(p.base_size_mm);
  products.push({
    id: p.id,
    slug: slugOf(p),
    article: p.article || family,
    family,
    type: typeOf(p.name),
    name: p.name,
    price: p.price_rub || null,
    base: size,
    greaseTraps: !/без жироуловител/i.test(p.short_description || ''),
    materials: ['AISI 430', 'AISI 304'],
    options: OPTIONS.map((o) => o.name),
    short: cleanShort(p.short_description),
    description: (p.description || '').trim(),
    features: [],
    images: LOCAL_IMAGES[p.article || family] || [],
    legacyUrl: new URL(p.permalink).pathname,
  });
}

for (const pr of products) {
  const ed = EDITORIAL[pr.article];
  if (ed) Object.assign(pr, ed);
}

products.sort((a, b) => (a.family + (a.type || '')).localeCompare(b.family + (b.type || ''), 'ru'));

/** Латинские слаги семейств — в URL кириллица не нужна. */
const FAMILY_SLUGS = {
  'ЗВП': 'zvp', 'ЗВО': 'zvo', 'ЗПВП': 'zpvp', 'ЗПВО': 'zpvo',
  'ЗВПГ': 'zvpg', 'ЗВОГ': 'zvog', 'ПИР': 'pir', 'ГФ': 'gf', 'АВТ': 'avt',
};

const families = Object.entries(FAMILIES).map(([code, f]) => {
  const items = products.filter((p) => p.family === code);
  const priced = items.filter((p) => p.price);
  return {
    code,
    ...f,
    slug: FAMILY_SLUGS[code],
    count: items.length,
    priceFrom: priced.length ? Math.min(...priced.map((p) => p.price)) : null,
  };
}).filter((f) => f.count > 0);

/* --- карта 301: старые URL WooCommerce → новые --- */
const CATEGORY_MAP = {
  'zonty-vytjazhnye-pristennye-zvp': 'zvp',
  'zonty-vytjazhnye-ostrovnye-zvo': 'zvo',
  'zonty-pritochno-vytjazhnye-pristennye': 'zpvp',
  'zonty-pritochno-vytjazhnye-ostrovnye-zpvo': 'zpvo',
  'zonty-vytjazhnye-pristennye-s-gidrozatvorom-zvpg': 'zvpg',
  'zonty-vytjazhnye-ostrovnye-s-gidrozatvorom-zvog': 'zvog',
  'zonty-vytjazhnye-kupolnye-piramida': 'pir',
  'gidrofiltr': 'gf',
  'avtomatika-dlja-gidrofiltrov': 'avt',
};

const redirects = [
  ...products.map((p) => ({ source: p.legacyUrl.replace(/\/$/, ''), destination: `/catalog/${p.slug}`, permanent: true })),
  ...Object.entries(CATEGORY_MAP).map(([oldSlug, code]) => ({
    source: `/product-category/${oldSlug}`, destination: `/catalog/${code}`, permanent: true,
  })),
  { source: '/shop', destination: '/catalog', permanent: true },
  { source: '/product-category/nejtralnoe-oborudovanie', destination: '/catalog', permanent: true },
];

fs.mkdirSync(path.join(ROOT, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/data/catalog.json'),
  JSON.stringify({ generatedAt: '2026-08-30', source: 'wentkompany.ru WooCommerce Store API', families, products }, null, 2));
fs.writeFileSync(path.join(ROOT, 'src/data/redirects.json'), JSON.stringify(redirects, null, 2));

console.log(`catalog.json: ${products.length} товаров, ${families.length} семейств`);
console.log(`redirects.json: ${redirects.length} правил`);
for (const f of families) console.log(`  ${f.code.padEnd(5)} ${String(f.count).padStart(2)} шт · от ${f.priceFrom ?? '—'} ₽`);
