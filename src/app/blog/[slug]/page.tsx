import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogProse } from '@/components/blog-prose';
import { JsonLd } from '@/components/json-ld';
import { allBlogSlugs, articleDates, getBlogArticle, listBlogArticles } from '@/lib/blog';
import { ORG_ID, WEBSITE_ID, absUrl, breadcrumbJsonLd, openGraph } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article) return { title: 'Статья' };
  const dates = articleDates(article.filename);
  const description = article.excerpt || article.title;
  return {
    title: article.title,
    description,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: openGraph({
      type: 'article',
      title: article.title,
      description,
      url: `/blog/${article.slug}`,
      ...(dates ? { publishedTime: dates.published, modifiedTime: dates.modified } : {}),
    }),
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article) notFound();

  const all = listBlogArticles();
  const idx = all.findIndex((a) => a.slug === slug);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  const url = absUrl(`/blog/${article.slug}`);
  const dates = articleDates(article.filename);
  // Автор — издатель сайта: персонального автора у статей нет, придумывать его нельзя
  const postJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.excerpt || article.title,
    url,
    mainEntityOfPage: url,
    inLanguage: 'ru-RU',
    isPartOf: { '@id': WEBSITE_ID },
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    ...(dates ? { datePublished: dates.published, dateModified: dates.modified } : {}),
  };

  return (
    <section className="band band-shop">
      <div className="wrap blog-article">
        <nav className="blog-crumbs lbl" aria-label="Навигация по разделу">
          <Link href="/blog" className="no-underline">
            Блог
          </Link>
          <span aria-hidden>/</span>
          <span>{article.title}</span>
        </nav>

        <div className="head blog-article__head">
          <p className="lbl">Статья</p>
          <h1>{article.title}</h1>
        </div>

        <BlogProse html={article.html} />

        <div className="blog-pager">
          {prev ? (
            <Link href={`/blog/${prev.slug}`} className="blog-pager__link no-underline">
              <span className="lbl">← Предыдущая</span>
              <span className="blog-pager__title">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/blog/${next.slug}`} className="blog-pager__link blog-pager__link--next no-underline">
              <span className="lbl">Следующая →</span>
              <span className="blog-pager__title">{next.title}</span>
            </Link>
          ) : null}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/blog" className="btn btn-ghost">
            Все статьи
          </Link>
          <Link href="/contacts" className="btn">
            Заявка на расчёт
          </Link>
        </div>

        <JsonLd data={postJsonLd} />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: 'Главная', path: '/' },
            { name: 'Блог', path: '/blog' },
            { name: article.title, path: `/blog/${article.slug}` },
          ])}
        />
      </div>
    </section>
  );
}
