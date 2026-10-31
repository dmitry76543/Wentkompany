import type { Metadata } from 'next';
import { site } from '@/lib/site';

/** Абсолютный URL на основном домене (JSON-LD требует полные адреса). */
export const absUrl = (path: string) => new URL(path, site.url).toString();

/** Узлы графа Schema.org, на которые ссылаются страницы через @id. */
export const ORG_ID = absUrl('/#organization');
export const WEBSITE_ID = absUrl('/#website');

export const SITE_TITLE = 'FortInox — гидрозонты, гидрофильтры и вытяжные зонты';

/**
 * Next.js заменяет openGraph страницы целиком, а не дополняет layout —
 * поэтому общие поля собираются здесь и подмешиваются в каждую страницу.
 */
export function openGraph(og: NonNullable<Metadata['openGraph']>): Metadata['openGraph'] {
  return {
    type: 'website',
    locale: 'ru_RU',
    siteName: site.name,
    ...og,
  } as Metadata['openGraph'];
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}
