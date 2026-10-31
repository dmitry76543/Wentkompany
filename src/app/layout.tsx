import type { Metadata } from 'next';
// Шрифты лежат в public/fonts и объявлены в fonts.css: ни одного запроса
// к fonts.googleapis.com из браузера посетителя. Начертания, нужные на первом
// экране, предзагружаются ниже — иначе крупный заголовок перерисовывается
// и страница под ним прыгает.
import './fonts.css';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ScrollRestore } from '@/components/scroll-restore';
import { site } from '@/lib/site';
import { Metrika } from '@/components/metrika';
import { JsonLd } from '@/components/json-ld';
import { ORG_ID, SITE_TITLE, WEBSITE_ID, absUrl, openGraph } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: SITE_TITLE,
    template: '%s · FortInox',
  },
  description: site.description,
  openGraph: openGraph({ title: SITE_TITLE, description: site.description }),
  robots: { index: true, follow: true },
};

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: site.name,
      url: absUrl('/'),
      telephone: site.phone,
      email: site.email,
      // география — как в site.address, без выдуманного юрадреса
      areaServed: [
        { '@type': 'City', name: 'Москва' },
        { '@type': 'AdministrativeArea', name: 'Московская область' },
      ],
      description: site.description,
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: site.name,
      url: absUrl('/'),
      inLanguage: 'ru-RU',
      publisher: { '@id': ORG_ID },
    },
  ],
};

/** Начертания первого экрана: заголовок, основной текст, моноширинные подписи. */
const PRELOAD = [
  '/fonts/oswald-cyrillic-700.woff2',
  '/fonts/oswald-cyrillic-600.woff2',
  '/fonts/onest-cyrillic-400.woff2',
  '/fonts/plex-mono-cyrillic-400.woff2',
  '/fonts/oswald-latin-700.woff2',
  '/fonts/onest-latin-400.woff2',
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {PRELOAD.map((href) => (
          <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
        ))}
      </head>
      <body>
        <Metrika />
        <ScrollRestore />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <JsonLd data={siteJsonLd} />
      </body>
    </html>
  );
}
