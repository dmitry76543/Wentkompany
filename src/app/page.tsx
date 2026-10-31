import type { Metadata } from 'next';
import { HomePageContent } from '@/components/home-page-content';
import { site } from '@/lib/site';
import { SITE_TITLE, openGraph } from '@/lib/seo';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: openGraph({ title: SITE_TITLE, description: site.description, url: '/' }),
};

export default function HomePage() {
  return <HomePageContent />;
}
