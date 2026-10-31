'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { site } from '@/lib/site';
import { GOALS, track } from '@/lib/analytics';

/**
 * Меню для телефона.
 *
 * На узких экранах основная навигация скрыта, и без этой кнопки с телефона
 * нельзя попасть ни в каталог, ни в нормы, ни в контакты — только на главную
 * и в конфигуратор. Панель закрывается при переходе и по Esc, фон под ней
 * не прокручивается.
 */

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="nav-toggle lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? '✕' : '≡'}</span>
      </button>

      {open && (
        <div id="mobile-nav" className="nav-sheet lg:hidden">
          <nav aria-label="Основная навигация">
            {links.map((l) => {
              const active =
                l.href === '/#catalog' || l.href.startsWith('/#')
                  ? pathname.startsWith('/catalog')
                  : pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <a
            href={site.phoneHref}
            className="num nav-sheet__phone"
            onClick={() => track(GOALS.callClick, { page: pathname })}
          >
            {site.phone}
          </a>
          <Link href="/configurator" className="btn w-full" onClick={() => setOpen(false)}>
            Собрать зонт
          </Link>
        </div>
      )}
    </>
  );
}
