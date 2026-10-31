import type { MetadataRoute } from 'next';
import { articleDates, listBlogArticles } from '@/lib/blog';
import { families, products } from '@/lib/catalog';
import { neutralItems } from '@/lib/neutral';
import { site } from '@/lib/site';

/**
 * lastModified только там, где дата известна (статьи — из git).
 * Время сборки вместо даты правки поисковики со временем перестают учитывать.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (p: string) => `${site.url}${p}`;
  const blog = listBlogArticles();

  return [
    { url: url('/'), changeFrequency: 'weekly', priority: 1 },
    { url: url('/normy-mchs'), changeFrequency: 'monthly', priority: 0.95 },
    { url: url('/dlya-obshchepita'), changeFrequency: 'monthly', priority: 0.9 },
    { url: url('/chastnyy-dom'), changeFrequency: 'monthly', priority: 0.85 },
    { url: url('/nestandartnyy-zont'), changeFrequency: 'monthly', priority: 0.88 },
    { url: url('/configurator'), changeFrequency: 'weekly', priority: 0.85 },
    { url: url('/blog'), changeFrequency: 'weekly', priority: 0.75 },
    ...blog.map((a) => {
      const dates = articleDates(a.filename);
      return {
        url: url(`/blog/${a.slug}`),
        ...(dates ? { lastModified: new Date(dates.modified) } : {}),
        changeFrequency: 'monthly' as const,
        priority: 0.65,
      };
    }),
    { url: url('/eshchyo-delaem'), changeFrequency: 'monthly', priority: 0.45 },
    ...neutralItems.map((item) => ({
      url: url(`/eshchyo-delaem/${item.slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
    { url: url('/contacts'), changeFrequency: 'yearly', priority: 0.5 },
    // линейка из одного изделия канонизирована на изделие — в карту не идёт
    ...families
      .filter((f) => f.count > 1)
      .map((f) => ({
        url: url(`/catalog/${f.slug}`),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      })),
    ...products.map((p) => ({
      url: url(`/catalog/${p.slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
