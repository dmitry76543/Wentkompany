import Link from 'next/link';
import { site } from '@/lib/site';
import { familyHref, hoodFamilies } from '@/lib/catalog';
import { CallLink } from '@/components/call-link';
import { MessengerLinks } from '@/components/messenger-links';

export function SiteFooter() {
  return (
    <footer className="border-t" style={{ borderColor: 'var(--hair)', background: 'var(--color-steel-900)' }}>
      <div className="wrap py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-[family-name:var(--font-display)] text-xl font-bold uppercase tracking-wide">
              Fort<span style={{ color: 'var(--color-extract)' }}>Inox</span>
            </span>
            <p className="muted mt-4 text-sm leading-relaxed max-w-[36ch]">{site.description}</p>
          </div>
          <div>
            <h2 className="mb-4 text-sm text-steel-300 normal-case tracking-normal">Каталог</h2>
            {hoodFamilies().map((f) => (
              <Link key={f.slug} href={familyHref(f.code)} className="site-footer-link">
                {f.title}
              </Link>
            ))}
            <Link href={familyHref('ГФ')} className="site-footer-link">
              Гидрофильтры
            </Link>
          </div>
          <div>
            <h2 className="mb-4 text-sm text-steel-300 normal-case tracking-normal">Решения</h2>
            <Link href="/dlya-obshchepita" className="site-footer-link">Для общепита</Link>
            <Link href="/chastnyy-dom" className="site-footer-link">Для частного дома</Link>
            <Link href="/nestandartnyy-zont" className="site-footer-link">Зонт по вашему чертежу</Link>
            <Link href="/eshchyo-delaem" className="site-footer-link">Нейтральное оборудование</Link>
            <Link href="/normy-mchs" className="site-footer-link">Требования СП 7.13130 · Изм. № 3</Link>
            <Link href="/blog" className="site-footer-link">Блог</Link>
            <Link href="/configurator" className="site-footer-link">Конфигуратор и выгрузка</Link>
            <Link href="/#catalog" className="site-footer-link">Типоразмеры и цены</Link>
          </div>
          <div>
            <h2 className="mb-4 text-sm text-steel-300 normal-case tracking-normal">Контакты</h2>
            <CallLink className="site-footer-link" />
            <a href={`mailto:${site.email}`} className="site-footer-link">{site.email}</a>
            <p className="mb-1.5 text-sm text-steel-400">{site.address}</p>
            <p className="mb-3 text-sm text-steel-400">{site.hours}</p>
            <MessengerLinks variant="icons" />
          </div>
        </div>
        <div
          className="lbl mt-10 flex flex-wrap justify-between gap-3 border-t pt-6"
          style={{ borderColor: 'var(--hair)' }}
        >
          <span>© 2026 {site.name}</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="no-underline transition-colors duration-200 hover:text-steel-100">
              Политика конфиденциальности
            </Link>
            <span>152-ФЗ</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
