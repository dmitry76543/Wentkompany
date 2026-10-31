import data from '@/data/catalog.json';
import type { Family, FamilyTraits, Dims } from './calc';
import { displayPriceMap, loadPricesFile } from './prices';

export interface FamilyRecord extends FamilyTraits {
  code: Family;
  slug: string;
  title: string;
  count: number;
  priceFrom: number | null;
}

export interface Product {
  id: number;
  slug: string;
  article: string;
  family: Family;
  type: string | null;
  name: string;
  /** Витринная цена (после формулы) либо null. */
  price: number | null;
  base: Dims | null;
  greaseTraps: boolean;
  materials: string[];
  options: string[];
  short: string;
  /** короткий список свойств; выводится маркированным списком на карточке */
  features: string[];
  description: string;
  images: string[];
  /** Статичная схемка-съёмка (под фото на главной и второй кадр галереи) */
  schemeImage?: string | null;
  legacyUrl: string;
}

/** Путь к схемке-съёмке типа, если есть. */
export const schemeOf = (p: Product) => p.schemeImage || null;

type RawProduct = Omit<Product, 'price'> & { price: number | null };

/** next/image не принимает локальные URL с ?v=… без images.localPatterns. */
function stripImageQuery(src: string): string {
  const i = src.indexOf('?');
  return i === -1 ? src : src.slice(0, i);
}

const rawFamilies = data.families as FamilyRecord[];
const rawProducts = (data.products as RawProduct[]).map((p) => ({
  ...p,
  images: (p.images ?? []).map(stripImageQuery),
  schemeImage: p.schemeImage ? stripImageQuery(p.schemeImage) : p.schemeImage,
}));

export const generatedAt = data.generatedAt as string;

/** Продукты с ценами из прайс-файла (формула −% затем +%). */
export function getProducts(): Product[] {
  const file = loadPricesFile();
  const map = displayPriceMap(file);
  return rawProducts.map((p) => ({
    ...p,
    /* Витрина только из прайса; catalog.json.price не для показа */
    price: map[p.article] ?? null,
  }));
}

/** Линейки с пересчитанным «от …». */
export function getFamilies(): FamilyRecord[] {
  const list = getProducts();
  return rawFamilies.map((f) => {
    const prices = list
      .filter((p) => p.family === f.code && p.price != null)
      .map((p) => p.price!);
    return {
      ...f,
      priceFrom: prices.length ? Math.min(...prices) : null,
    };
  });
}

/** @deprecated для совместимости — предпочтительнее getProducts() */
export const products = rawProducts as Product[];
/** @deprecated предпочтительнее getFamilies() */
export const families = rawFamilies;

export const familyBySlug = (slug: string) => getFamilies().find((f) => f.slug === slug);
export const familyByCode = (code: string) => getFamilies().find((f) => f.code === code);
export const productBySlug = (slug: string) => getProducts().find((p) => p.slug === slug);
export const productsOf = (code: string) => getProducts().filter((p) => p.family === code);

/** Изделие, которое заменяет страницу линейки из одного типоразмера (ГФ, АВТ, ПИР, ЗВПГ, ЗВОГ). */
export function soleProductOf(code: string): Product | null {
  const items = productsOf(code);
  return items.length === 1 ? items[0] : null;
}

/** Канонический адрес линейки: у однопозиционной — страница самого изделия. */
export function familyHref(code: string): string {
  const sole = soleProductOf(code);
  if (sole) return `/catalog/${sole.slug}`;
  const f = familyByCode(code);
  return f ? `/catalog/${f.slug}` : '/#catalog';
}

export const traitsOf = (code: string): FamilyTraits => {
  const f = familyByCode(code);
  return { island: !!f?.island, supply: !!f?.supply, hydro: !!f?.hydro };
};

/** Изделия, попадающие под пп. 5.28–5.33 СП 7.13130.2013. */
export const complianceProducts = () =>
  getProducts().filter(
    (p) => p.family === 'ЗВПГ' || p.family === 'ЗВОГ' || p.family === 'ГФ' || p.family === 'АВТ',
  );

/** Линейки зонтов для профессиональной кухни без открытого огня. */
export const hoodFamilies = () =>
  getFamilies().filter((f) => ['ЗВП', 'ЗВО', 'ЗПВП', 'ЗПВО', 'ПИР'].includes(f.code));

/** Каталог на главной: обычные зонты, гидрозатвор, ПИР/ГФ/АВТ. */
export const homeCatalogFamilies = () =>
  getFamilies().filter((f) =>
    ['ЗВП', 'ЗВО', 'ЗПВП', 'ЗПВО', 'ЗВПГ', 'ЗВОГ', 'ПИР', 'ГФ', 'АВТ'].includes(f.code),
  );

export const priceFrom = (code: string) => familyByCode(code)?.priceFrom ?? null;

export const shortName = (p: Product) =>
  `${p.article}${p.type ? ` · ${p.type}` : ''}`;

export const sizeLabel = (d: Dims | null) => (d ? `${d.h} / ${d.w} / ${d.d}` : '—');
