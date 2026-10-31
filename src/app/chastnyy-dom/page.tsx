import type { Metadata } from 'next';
import Link from 'next/link';
import { Process } from '@/components/process';
import { Cases, hasCases } from '@/components/cases';
import { CallLink } from '@/components/call-link';
import { PageBackdrop } from '@/components/page-backdrop';
import { familyHref, priceFrom } from '@/lib/catalog';
import { rub } from '@/lib/calc';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Вытяжной зонт над мангалом в частном доме — изготовление по размеру',
  description:
    'Зонт над мангалом, хоспером и тандыром в доме, беседке и на летней кухне. Нержавеющая сталь, ' +
    'гидрозатвор вместо кассет, изготовление по замеру. Цена типоразмера сразу.',
  alternates: { canonical: '/chastnyy-dom' },
  openGraph: {
    title: 'Вытяжной зонт над мангалом в частном доме',
    description: 'Изготовление по замеру, нержавеющая сталь, гидрозатвор вместо кассет.',
  },
};

const SITUATIONS = [
  {
    tag: 'Мангальная зона в доме',
    title: 'Дым не должен уходить в гостиную',
    text: 'Открытый очаг в помещении требует полноценного улавливания и отдельного тракта наружу. Зонт делается по размеру ниши, а не подгоняется из готового.',
    href: familyHref('ЗВПГ'),
    cta: 'Пристенный с гидрозатвором',
  },
  {
    tag: 'Беседка, летняя кухня',
    title: 'Очаг стоит по центру',
    text: 'Островной зонт с подвесом на четыре точки — по габаритам стола или мангала, с учётом свеса над очагом.',
    href: familyHref('ЗВОГ'),
    cta: 'Островной с гидрозатвором',
  },
  {
    tag: 'Домашняя кухня без огня',
    title: 'Плита, гриль, пароконвектомат',
    text: 'Когда открытого огня нет, гидрозатвор избыточен: достаточно вытяжного или приточно-вытяжного зонта с жироулавливающими фильтрами.',
    href: '/#catalog',
    cta: 'Смотреть типоразмеры',
  },
];

const WHY = [
  {
    title: 'Гидрозатвор вместо кассет',
    text: 'Плёнка воды снимает жир и гасит искру прямо в зонте. Не нужно раз в неделю снимать и отмывать кассеты — обслуживание сводится к сливу и промывке контура.',
  },
  {
    title: 'Нержавеющая сталь, не крашеный металл',
    text: 'AISI 430 как стандарт, AISI 304 — там, где важна стойкость к влаге и чистящей химии. Шов и кромка на виду, поэтому делаются аккуратно.',
  },
  {
    title: 'Размер под место, а не место под размер',
    text: 'Ширина, глубина и высота задаются с шагом в миллиметр. Подвес, вывод патрубка и сторона подключения — по вашему чертежу.',
  },
  {
    title: 'Видно до изготовления',
    text: 'В конфигураторе изделие показано в 3D и в виде чертежа с размерами. Чертёж можно отправить дизайнеру интерьера или монтажнику до заказа.',
  },
];

const FAQ = [
  {
    q: 'Чем зонт с гидрозатвором отличается от обычного?',
    a: 'В обычном зонте жир задерживают лабиринтные кассеты, которые надо регулярно снимать и мыть. В зонте с гидрозатвором работает водяная плёнка: она снимает жир и гасит искру внутри изделия, поэтому в канал уходит заметно меньше отложений. Для открытого огня — мангала, хоспера, тандыра — это принципиальная разница.',
  },
  {
    q: 'Нужен ли подвод воды и слив?',
    a: 'Да, изделию с гидрозатвором нужны подвод воды и слив в канализацию. Точки подключения закладываются на этапе замера, до отделки. Для зонта без гидрозатвора ничего этого не требуется.',
  },
  {
    q: 'Насколько это шумно?',
    a: 'Шум даёт вентилятор, а не зонт. Уровень зависит от подобранного вентилятора и сечения канала: при запасе по сечению скорость воздуха ниже и шум меньше. Мы считаем расход и подбираем диаметры патрубков под него.',
  },
  {
    q: 'Сколько стоит и от чего зависит цена?',
    a: `Цена определяется типом изделия, габаритами и маркой стали. Пристенный зонт с гидрозатвором — от ${rub(priceFrom('ЗВПГ') ?? 0)}, островной — от ${rub(priceFrom('ЗВОГ') ?? 0)}, обычный вытяжной зонт — от ${rub(priceFrom('ЗВП') ?? 0)}. Нестандартный размер считается от площади изделия; итоговую цену подтверждаем расчётом.`,
  },
  {
    q: 'Действуют ли требования МЧС для частного дома?',
    a: 'Пункты 5.28–5.33 СП 7.13130.2013 в редакции Изменения № 3 написаны прежде всего для объектов с оборудованием для приготовления пищи на открытом огне в зданиях общественного назначения. Применимость к конкретному частному дому определяется проектом и типом здания, и мы этот вопрос за проектировщика не решаем. Инженерная логика при этом та же: улавливание над очагом, гашение искры, отдельный тракт наружу.',
  },
  {
    q: 'Можно ли встроить зонт в короб или отделку?',
    a: 'Да, изделие изготавливается под нишу или короб, с учётом закладных под подвес. Нужен эскиз или размеры узла от дизайнера — по ним делаем чертёж и согласуем до запуска в производство.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function ChastnyyDomPage() {
  return (
    <>
      <section className="band band-shop page-hero band--backdrop">
        <PageBackdrop theme="home" />
        <div className="wrap">
          <div className="backdrop-copy max-w-[52ch]">
            <p className="lbl">Частный дом · беседка · летняя кухня</p>
            <h1>
              Мангал в доме —<br />
              <span style={{ color: 'var(--color-extract)' }}>без дыма</span><br />
              в гостиной.
            </h1>
            <p className="muted mt-6 text-lg leading-relaxed">
              Вытяжные зонты и зонты с гидрозатвором из нержавеющей стали — по вашему месту.
              Габариты с точностью до миллиметра. Чертёж согласуем до начала работ.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/configurator" className="btn">Подобрать размер и увидеть цену</Link>
              <Link href="/contacts" className="btn btn-ghost">Вызвать на замер</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="band band-deep">
        <div className="wrap">
          <div className="head">
            <p className="lbl">С чем приходят</p>
            <h2>Три типичные ситуации</h2>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {SITUATIONS.map((s) => (
              <article key={s.title} className="tile">
                <span className="tag">
                  {s.tag}
                </span>
                <h3 style={{ textTransform: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1.05rem' }}>
                  {s.title}
                </h3>
                <p className="muted text-sm">{s.text}</p>
                <Link
                  href={s.href}
                  className="tile-cta"
                >
                  {s.cta} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-shop">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Почему так</p>
            <h2>Разница видна на второй год эксплуатации</h2>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {WHY.map((w) => (
              <article key={w.title} className="tile">
                <h3 style={{ textTransform: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1.05rem' }}>
                  {w.title}
                </h3>
                <p className="muted text-sm">{w.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/configurator" className="btn">Открыть конфигуратор</Link>
            <Link href="/#catalog" className="btn btn-ghost">Типоразмеры и цены</Link>
          </div>
        </div>
      </section>

      {hasCases && (
        <section className="band band-deep">
          <div className="wrap">
            <div className="head">
              <p className="lbl">Объекты</p>
              <h2>Как это выглядит в доме</h2>
            </div>
            <Cases limit={3} kind="Частный дом" />
          </div>
        </section>
      )}

      <section className="band band-shop">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Порядок работы</p>
            <h2>От замера до запуска</h2>
            <p>
              Для частного дома шаг с передачей DXF и IFC обычно не нужен — он остаётся,
              если проект дома ведёт архитектурное бюро.
            </p>
          </div>
          <Process />
        </div>
      </section>

      <section className="band band-paper">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Вопросы</p>
            <h2>Что спрашивают до заказа</h2>
          </div>
          <div className="flex flex-col gap-4">
            {FAQ.map((f) => (
              <details key={f.q} className="border p-5" style={{ borderColor: 'rgba(0,0,0,.14)' }}>
                <summary className="cursor-pointer text-base font-semibold">{f.q}</summary>
                <p className="mt-3 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-shop">
        <div className="wrap flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2>Приедем на замер</h2>
            <p className="muted mt-3 max-w-[52ch]">
              Пришлите фото места и примерные габариты очага — скажем, что можно поставить,
              ещё до выезда.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contacts" className="btn">Оставить заявку</Link>
            <CallLink className="btn btn-ghost num" label={site.phone} />
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </>
  );
}
