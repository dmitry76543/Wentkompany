import Link from 'next/link';
import Image from 'next/image';
import { HoodDiagram } from '@/components/hood-diagram';
import { HomeCatalog } from '@/components/home-catalog';
import { HeroVisualSlider } from '@/components/hero-visual-slider';
import { PageBackdrop } from '@/components/page-backdrop';
import { complianceProducts, priceFrom } from '@/lib/catalog';
import { rub } from '@/lib/calc';
import { norms } from '@/lib/site';

const TRACKS = [
  {
    tag: 'Инженер · проектировщик · монтажник',
    title: 'Данные и файлы',
    text: 'Габариты до миллиметра, расчёт расхода воздуха и подбор патрубков — сразу в конфигураторе.',
    items: ['2D-чертёж с размерными цепями', 'PDF-спецификация для тендера', 'DXF, далее IFC и Revit'],
    href: '/configurator',
    cta: 'Открыть конфигуратор',
  },
  {
    tag: 'Ресторан · столовая · тёмная кухня',
    title: 'Срок, цена, приёмка',
    text: 'Подбор по оборудованию на линии и комплект под требования МЧС для открытого огня.',
    items: ['Цена по типоразмеру сразу', 'Схема тракта по пп. 5.28–5.33', 'Монтаж и пусконаладка'],
    href: '/dlya-obshchepita',
    cta: 'Решения для общепита',
  },
  {
    tag: 'Частный дом · мангальная зона',
    title: 'Чтобы не пахло в доме',
    text: 'Зонт над мангалом, хоспером или летней кухней — по месту и под интерьер.',
    items: ['Замер и изготовление по размеру', 'Гидрозатвор вместо кассет', 'Тихий режим работы'],
    href: '/chastnyy-dom',
    cta: 'Зонт для дома',
  },
];

/** Разметка главной — общая для сайта и превью палитр. */
export function HomePageContent() {
  return (
    <>
      <section className="band band-shop page-hero band--backdrop">
        <PageBackdrop theme="shop" />
        <div className="wrap hero">
          <div className="hero__copy">
            <p className="lbl">
              Нержавеющая сталь AISI 430 / 304
            </p>
            <h1>
              Вытяжные зонты<br />и гидрофильтры<br />
              <span style={{ color: 'var(--color-extract)' }}>из нержавеющей стали</span>
            </h1>
            <p className="muted mt-6 max-w-[48ch] text-lg leading-relaxed">
              Для кухонь общепита и мангальных зон: от типоразмера из прайса
              до изделия по вашему чертежу. Чертёж, цена и спецификация — до запуска в производство.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/configurator" className="btn">Собрать зонт</Link>
              <Link href="/#catalog" className="btn btn-ghost">Смотреть каталог</Link>
            </div>
          </div>
          <div className="hero__visual hero__visual--photo">
            <Image
              src="/backdrops/home-hero-hood.webp"
              alt="Пирамидальный вытяжной зонт из нержавеющей стали на производстве"
              width={1152}
              height={864}
              priority
              className="hero__photo"
              sizes="(max-width: 960px) 100vw, 48vw"
            />
          </div>
        </div>
      </section>

      <section className="band band-paper">
        <div className="wrap">
          <div className="head">
            <p className="lbl">С чего начнём</p>
            <h2>Выберите, кто вы — дальше сайт говорит на вашем языке</h2>
            <p>
              Проектировщику нужны цифры и файлы. Ресторану — срок и приёмка.
              Частному дому — чтобы в гостиной не пахло углём.
            </p>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {TRACKS.map((t) => (
              <article key={t.title} className="tile">
                <span className="tag">{t.tag}</span>
                <h3>{t.title}</h3>
                <p className="muted text-sm leading-relaxed">{t.text}</p>
                <ul className="muted list-disc pl-4 text-sm leading-relaxed">
                  {t.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
                <Link href={t.href} className="tile-cta">
                  {t.cta} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-deep band--backdrop">
        <PageBackdrop theme="fire" />
        <div className="wrap">
          <div className="head backdrop-copy">
            <p className="lbl">Открытый огонь</p>
            <h2>Мангал и тандыр — с 1 июля 2025 по новым правилам</h2>
            <p className="muted">
              {norms.change} к {norms.sp} ({norms.order}) дополнило раздел 5 пунктами {norms.clauses}.
              Гидрофильтр, зонт с гидрозатвором и щит автоматики — позиции, которыми закрывается требование.
            </p>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
            {complianceProducts().map((p) => (
              <Link key={p.id} href={`/catalog/${p.slug}`} className="tile no-underline">
                <span className="lbl">{p.article}</span>
                <h3>{p.name.replace(/\s*\([^)]*\)\s*$/, '')}</h3>
                <span className="num mt-auto border-t pt-3 text-lg" style={{ borderColor: 'var(--hair)' }}>
                  {p.price ? `от ${rub(p.price)}` : 'после расчёта'}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/normy-mchs" className="btn mt-8">Разобрать требования по пунктам</Link>
        </div>
      </section>

      {/* Без фото: сосед сверху уже с backdrop — черезстрочная полоса */}
      <section id="catalog" className="band band-catalog">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Каталог</p>
            <h2>Каталог: зонты, гидрофильтр и автоматика</h2>
          </div>
          <HomeCatalog />
        </div>
      </section>

      <section className="band band-shop">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Экономика</p>
            <h2>Что даёт эффективная фильтрация, кроме приёмки</h2>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
            {[
              ['12 → 2', 'раза в год — столько чисток воздуховодов остаётся после внедрения эффективной фильтрации'],
              ['+15 %', 'КПД вентиляции горячего цеха по результатам того же исследования'],
              ['0', 'переделок на приёмке, если тракт собран по пп. 5.28–5.33 сразу'],
              ['AISI 304', 'для влажных зон и гидроконтура; аргонодуговая сварка'],
            ].map(([n, t]) => (
              <div key={n} className="tile">
                <b className="num text-3xl leading-none" style={{ color: 'var(--color-extract)' }}>{n}</b>
                <span className="muted text-sm leading-relaxed">{t}</span>
              </div>
            ))}
          </div>
          <p className="lbl mt-5 leading-relaxed">
            Источник по первым двум показателям:{' '}
            <a
              href="https://cyberleninka.ru/article/n/optimizatsiya-sistem-ventilyatsii-goryachih-tsehov-predpriyatiy-obschestvennogo-pitaniya"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-supply)' }}
            >
              «Оптимизация систем вентиляции горячих цехов предприятий общественного питания», КиберЛенинка
            </a>
          </p>
        </div>
      </section>

      <section className="band band-deep band--backdrop">
        <PageBackdrop theme="draft" />
        <div className="wrap">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="backdrop-copy">
              <p className="lbl">Производство по чертежам заказчика</p>
              <h2 className="mt-4">Зонт под место,<br />а не место под зонт</h2>
              <p className="muted mt-5 max-w-[52ch] leading-relaxed">
                Ниша нетиповой ширины, скошенная стена, колонна посреди зоны, вывод тракта вбок.
                Изделие варится под конкретное место. Чертёж вы согласуете до запуска в производство.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/nestandartnyy-zont" className="btn">Зонт по вашему чертежу</Link>
                <Link href="/contacts" className="btn btn-ghost">Задать вопрос</Link>
              </div>
              <p className="lbl mt-8">Соберите изделие — пришлём чертёж и цену</p>
              <p className="muted mt-2 max-w-[52ch] leading-relaxed">
                Конфигурация прикрепляется к заявке автоматически: повторять размеры не нужно.
                Гидрофильтр — от {rub(priceFrom('ГФ') ?? 120000)}, зонт с гидрозатвором — от{' '}
                {rub(priceFrom('ЗВПГ') ?? 45000)}.
              </p>
            </div>
            <div className="hero__visual hero__visual--zoom hero__visual--slider">
              <HeroVisualSlider diagram={<HoodDiagram island compact />} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
