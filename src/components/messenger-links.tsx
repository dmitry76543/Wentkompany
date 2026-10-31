'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { site } from '@/lib/site';

type MessengerId = keyof typeof site.messengers;

function MaxIcon() {
  return (
    <Image
      src="/icons/max.webp"
      alt=""
      width={56}
      height={56}
      className="messenger-links__img"
      unoptimized
    />
  );
}

function WhatsAppIcon({ gradId }: { gradId: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden width="40" height="40" className="messenger-links__badge">
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#0E9F6E" />
          <stop offset="45%" stopColor="#25D366" />
          <stop offset="100%" stopColor="#5CFF95" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${gradId})`} />
      <path
        fill="#fff"
        d="M20.04 8.2a9.9 9.9 0 0 0-8.5 14.9L9.2 28.2l5.26-1.38a9.9 9.9 0 1 0 5.58-18.62Zm0 1.8a8.1 8.1 0 0 1 6.9 12.3l-.3.5.7 2.55-2.62-.69-.5.3a8.1 8.1 0 1 1-4.18-14.96Zm4.66 11.55c-.25-.12-1.48-.73-1.71-.81-.23-.09-.4-.12-.57.12-.17.25-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.09-.17.04-.31-.02-.43-.06-.12-.57-1.37-.78-1.88-.2-.48-.41-.42-.57-.43h-.49c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.57c.12.17 1.75 2.67 4.24 3.74 1.49.64 1.9.7 2.58.59.42-.07 1.48-.6 1.69-1.19.21-.58.21-1.08.15-1.19-.06-.1-.23-.17-.48-.29Z"
      />
    </svg>
  );
}

function TelegramIcon({ gradId }: { gradId: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden width="40" height="40" className="messenger-links__badge">
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1C9FE8" />
          <stop offset="45%" stopColor="#2AABEE" />
          <stop offset="100%" stopColor="#7AD4FF" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${gradId})`} />
      <path
        fill="#fff"
        d="M29.9 11.05 27.4 23.3c-.2.88-.72 1.1-1.46.68l-4.03-2.97-1.94 1.87c-.22.22-.4.4-.79.4l.29-4.1 7.47-6.75c.33-.29-.07-.45-.5-.16l-9.25 5.82-3.68-1.15c-.86-.27-.88-.86.19-1.3l15.24-5.88c.72-.26 1.35.18 1.28.99Z"
      />
    </svg>
  );
}

function useFinePointer() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setOk(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return ok;
}

/**
 * Липкая кнопка: тянется к курсору в радиусе притяжения, отпускает при уходе.
 */
function StickyHit({
  children,
  className,
  style,
  href,
  title,
  ariaLabel,
  strength = 0.38,
  maxPull = 14,
}: {
  children: ReactNode;
  className: string;
  style?: CSSProperties;
  href?: string;
  title: string;
  ariaLabel: string;
  strength?: number;
  maxPull?: number;
}) {
  const ref = useRef<HTMLAnchorElement | HTMLSpanElement>(null);
  const fine = useFinePointer();
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const reset = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--sticky-x', '0px');
    el.style.setProperty('--sticky-y', '0px');
    el.style.removeProperty('--sticky-scale');
  }, []);

  const onMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!fine || reduced.current) return;
      if (e.pointerType !== 'mouse') return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = Math.min(maxPull, dist * strength);
      const x = (dx / dist) * pull;
      const y = (dy / dist) * pull;
      el.style.setProperty('--sticky-x', `${x.toFixed(2)}px`);
      el.style.setProperty('--sticky-y', `${y.toFixed(2)}px`);
      el.style.setProperty('--sticky-scale', '1.06');
    },
    [fine, maxPull, strength],
  );

  const common = {
    className: `${className} messenger-links__sticky`,
    style,
    title,
    'aria-label': ariaLabel,
    onPointerMove: onMove,
    onPointerLeave: reset,
    onBlur: reset,
  } as const;

  if (href) {
    return (
      <a
        {...common}
        ref={ref as RefObject<HTMLAnchorElement>}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <span {...common} ref={ref as RefObject<HTMLSpanElement>}>
      {children}
    </span>
  );
}

/**
 * Ссылки на мессенджеры.
 * variant="full" — контакты (иконка + подпись).
 * variant="icons" — только значки (футер).
 */
export function MessengerLinks({ variant = 'full' }: { variant?: 'full' | 'icons' }) {
  const uid = useId().replace(/:/g, '');
  const iconsOnly = variant === 'icons';

  const items: { id: MessengerId; label: string; brand: string; icon: ReactNode }[] = [
    { id: 'max', label: 'Max', brand: '#5B4BFF', icon: <MaxIcon /> },
    {
      id: 'telegram',
      label: 'Telegram',
      brand: '#2AABEE',
      icon: <TelegramIcon gradId={`tg-${uid}`} />,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      brand: '#25D366',
      icon: <WhatsAppIcon gradId={`wa-${uid}`} />,
    },
  ];

  return (
    <div className={`messenger-links${iconsOnly ? ' messenger-links--icons' : ''}`}>
      {!iconsOnly && <p className="lbl">Написать в мессенджер</p>}
      <ul className="messenger-links__list">
        {items.map((item) => {
          const href = site.messengers[item.id] || undefined;
          const ready = Boolean(href);
          const className = iconsOnly
            ? `messenger-links__icon-btn${ready ? '' : ' messenger-links__icon-btn--pending'}`
            : `messenger-links__item${ready ? '' : ' messenger-links__item--pending'}`;
          const style = { ['--messenger-brand' as string]: item.brand };
          const title = item.label;

          const inner = iconsOnly ? (
            <span className="messenger-links__glyph" aria-hidden>
              {item.icon}
            </span>
          ) : (
            <>
              <span className="messenger-links__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="messenger-links__label">{item.label}</span>
            </>
          );

          return (
            <li key={item.id}>
              <StickyHit
                className={className}
                style={style}
                href={href}
                title={title}
                ariaLabel={title}
                strength={iconsOnly ? 0.45 : 0.32}
                maxPull={iconsOnly ? 16 : 12}
              >
                {inner}
              </StickyHit>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
