import type { Metadata } from 'next';
import Link from 'next/link';
import { RoiCalculator } from '@/components/roi-calculator';
import { ComplianceCheck } from '@/components/compliance-check';
import { Process } from '@/components/process';
import { Cases, hasCases } from '@/components/cases';
import { CallLink } from '@/components/call-link';
import { PageBackdrop } from '@/components/page-backdrop';
import { familyHref, priceFrom } from '@/lib/catalog';
import { rub } from '@/lib/calc';
import { norms, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Вытяжка для ресторана и кухни общепита — зонты и гидрофильтры',
  description:
    'Вытяжные зонты, гидрозонты и гидрофильтры для ресторанов, кафе, столовых и тёмных кухонь. ' +
    'Комплект под пп. 5.28–5.33 СП 7.13130.2013 для мангалов и тандыров, цена по типоразмеру, монтаж.',
  alternates: { canonical: '/dlya-obshchepita' },
  openGraph: {
    title: 'Вытяжка для ресторана и кухни общепита',
    description: 'Зонты и гидрофильтры под требования МЧС, цена по типоразмеру, чертежи для проекта.',
  },
};

/** Боли объекта общепита — каждая привязана к проверяемому факту, не к лозунгу. */
const PAINS = [
  {
    title: 'Приёмка и проверка',
    text: `С ${norms.inForce} удаление продуктов горения от мангалов, тандыров и хосперов регулируется прямо: ${norms.sp}, ${norms.change}, пп. ${norms.clauses}. Инспектор смотрит не на зонт, а на весь тракт — от аппарата до оголовка.`,
    link: { href: '/normy-mchs', label: 'Разбор пунктов 5.28–5.33' },
  },
  {
    title: 'Жир в канале',
    text: 'Кассетный фильтр задерживает крупную фракцию, а лёгкая оседает в воздуховоде. Дальше — ежемесячная чистка канала подрядчиком и риск возгорания отложений.',
    link: { href: '#okupaemost', label: 'Посчитать чистки' },
  },
  {
    title: 'Запах на улицу и к соседям',
    text: 'Жалобы жильцов встроенного дома — типовая причина предписаний. Гидрозатвор снимает основную массу жира и сажи до выхода в канал.',
    link: { href: familyHref('ЗВПГ'), label: 'Зонты с гидрозатвором' },
  },
  {
    title: 'Сроки перед открытием',
    text: 'Зонт нестандартного размера часто оказывается на критическом пути. Габариты, чертёж и цена — сразу в конфигураторе, без переписки на неделю.',
    link: { href: '/configurator', label: 'Собрать зонт' },
  },
];

const KIT = [
  {
    role: 'Улавливание над аппаратом',
    item: 'Зонт с гидрозатвором ЗВПГ или ЗВОГ',
    price: priceFrom('ЗВПГ'),
    note: (
      <>
        Закрывает{' '}
        <Link href="/normy-mchs#clause-5.28" style={{ color: 'var(--color-supply)' }}>пп. 5.28</Link>
        {' '}и{' '}
        <Link href="/normy-mchs#clause-5.30" style={{ color: 'var(--color-supply)' }}>5.30</Link>
        {' '}одним изделием: улавливание и гашение искры внутри зонта.
      </>
    ),
    href: familyHref('ЗВПГ'),
  },
  {
    role: 'Отдельно стоящая фильтрация',
    item: 'Гидрофильтр ГФ',
    price: priceFrom('ГФ'),
    note: 'Когда над аппаратом уже стоит зонт и тракт нужно закрыть отдельным аппаратом в том же помещении.',
    href: familyHref('ГФ'),
  },
  {
    role: 'Контроль и сигнализация',
    item: 'Щит управления и диспетчеризации',
    price: null,
    note: (
      <>
        Датчики температуры, сигнализаторы давления воды, световой и звуковой сигнал — прямая формулировка{' '}
        <Link href="/normy-mchs#clause-5.30" style={{ color: 'var(--color-supply)' }}>п. 5.30</Link>.
      </>
    ),
    href: familyHref('АВТ'),
  },
  {
    role: 'Кухня без открытого огня',
    item: 'Зонты ЗВП, ЗВО, приточно-вытяжные ЗПВП и ЗПВО',
    price: priceFrom('ЗВП'),
    note: 'Плиты, пароконвектоматы, фритюр, посудомойка — типоразмеры с ценой из прайса.',
    href: '/#catalog',
  },
];

const FAQ = [
  {
    q: 'Что спросят при проверке по мангалу или тандыру?',
    a: 'Схему удаления продуктов горения наружу отдельным трактом (п. 5.28), негорючий пол по периметру и разрывы до горючего (п. 5.29), наличие гидрофильтра или зонта с гидрозатвором вместе с датчиками температуры и сигнализаторами давления воды (п. 5.30), огнестойкость воздуховода после фильтра не ниже EI 45 (п. 5.32) и характеристики вентилятора, если он повышает тягу (п. 5.33).',
  },
  {
    q: 'Можно ли обойтись без гидрофильтра?',
    a: 'Формально п. 5.30 говорит о применении гидрофильтров как о возможности. Но без него п. 5.31 требует, чтобы дымовой канал на всём протяжении соответствовал п. 5.11 СП и ГОСТ Р 53321 — во встроенном помещении это почти нереализуемо. Поэтому на практике выбор сводится к гидрофильтру или зонту с гидрозатвором.',
  },
  {
    q: 'Работает ли это на действующем ресторане, а не только на новом?',
    a: 'Требования применяются при проектировании и реконструкции. На действующем объекте вопрос возникает при изменении технологии, замене оборудования на открытый огонь или по результатам проверки. Точную применимость к конкретному объекту определяет проектная организация и надзорный орган — мы отвечаем за оборудование и документы на него.',
  },
  {
    q: 'Даёте ли документы для приёмки?',
    a: 'Паспорт изделия, схему тракта и исполнительную документацию по монтажу. Для проекта отдаём чертёж в PDF и DXF, а модель изделия — в IFC, чтобы проектировщик вставил её в общую модель.',
  },
  {
    q: 'Сколько стоит комплект?',
    a: `Зонт с гидрозатвором — от ${rub(priceFrom('ЗВПГ') ?? 0)}, отдельный гидрофильтр — от ${rub(priceFrom('ГФ') ?? 0)}. Щит автоматики и нестандартные габариты считаются по объекту. Цену типоразмера видно сразу в каталоге и в конфигураторе.`,
  },
  {
    q: 'Кто делает монтаж?',
    a: 'Монтаж и пусконаладку выполняем сами: подвес, подключение воды и слива, настройка датчиков и проверка сигнализации. Огнестойкий воздуховод и электроснабжение по 1-й категории закладываются в проект объекта.',
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

export default function ObshchepitPage() {
  return (
    <>
      <section className="band band-shop page-hero band--backdrop">
        <PageBackdrop theme="kitchen" />
        <div className="wrap">
          <div className="backdrop-copy max-w-[58ch]">
            <p className="lbl">Ресторан · кафе · столовая · тёмная кухня</p>
            <h1>
              Кухня работает.<br />
              <span style={{ color: 'var(--color-extract)' }}>Канал чистый.</span><br />
              Приёмка проходит.
            </h1>
            <p className="muted mt-6 text-lg leading-relaxed">
              Зонты, гидрозонты и гидрофильтры собственного производства. Считаем комплект под вашу
              линию, отдаём чертежи в проект и выполняем монтаж.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contacts" className="btn">Запросить расчёт комплекта</Link>
              <Link href="/configurator" className="btn btn-ghost">Собрать зонт и увидеть цену</Link>
            </div>
            <p className="hint mt-5">
              Открытый огонь на линии — сначала{' '}
              <Link href="/normy-mchs" style={{ color: 'var(--color-supply)' }}>требования МЧС</Link>,
              затем оборудование.
            </p>
          </div>
        </div>
      </section>

      <section className="band band-deep">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Что обычно болит</p>
            <h2>Четыре вопроса, которые приходят с кухни</h2>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {PAINS.map((p) => (
              <article key={p.title} className="tile">
                <h3 style={{ textTransform: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1.05rem' }}>
                  {p.title}
                </h3>
                <p className="muted text-sm">{p.text}</p>
                <Link
                  href={p.link.href}
                  className="tile-cta"
                >
                  {p.link.label} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-shop" id="komplekt">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Комплект</p>
            <h2>Что ставим на объект общепита</h2>
            <p>
              Цены — из действующего прайса для базового типоразмера. Нестандарт считается от площади
              изделия, итог подтверждаем расчётом.
            </p>
          </div>
          <div className="scroll-x">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr className="lbl" style={{ borderBottom: '1px solid var(--hair)' }}>
                  <th className="py-3 text-left">Роль в тракте</th>
                  <th className="py-3 text-left">Изделие</th>
                  <th className="py-3 text-left">Цена от</th>
                  <th className="py-3 text-left">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {KIT.map((k) => (
                  <tr key={k.role} style={{ borderBottom: '1px solid var(--hair)' }}>
                    <td className="py-4 pr-4 align-top" style={{ color: 'var(--color-steel-300)' }}>{k.role}</td>
                    <td className="py-4 pr-4 align-top">
                      <Link href={k.href} style={{ color: 'var(--color-supply)' }}>{k.item}</Link>
                    </td>
                    <td className="num py-4 pr-4 align-top whitespace-nowrap">
                      {k.price ? rub(k.price) : 'по объекту'}
                    </td>
                    <td className="muted py-4 align-top">{k.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="band band-deep band--backdrop" id="okupaemost">
        <PageBackdrop theme="clean" />
        <div className="wrap">
          <div className="head backdrop-copy">
            <p className="lbl">Окупаемость</p>
            <h2>Считаем на чистках канала, а не на страхе перед штрафом</h2>
            <p className="muted">
              Эффективная фильтрация сокращает число чисток воздуховода. Всё остальное — риск
              возгорания, простой кухни, санкции при проверке — мы намеренно не переводим в рубли:
              такую цифру нечем подтвердить.
            </p>
          </div>
          <RoiCalculator />
        </div>
      </section>

      <section className="band band-shop">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Чек-лист</p>
            <h2>Проверьте объект по пунктам 5.28–5.33</h2>
            <p>
              Семь вопросов о том, что уже стоит на кухне. Ответы никуда не отправляются — список
              пробелов собирается прямо в браузере.
            </p>
          </div>
          <ComplianceCheck />
        </div>
      </section>

      {hasCases && (
        <section className="band band-deep">
          <div className="wrap">
            <div className="head">
              <p className="lbl">Объекты</p>
              <h2>Где это уже стоит</h2>
            </div>
            <Cases limit={3} />
          </div>
        </section>
      )}

      <section className="band band-shop">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Порядок работы</p>
            <h2>От замера до документов на приёмку</h2>
          </div>
          <Process />
        </div>
      </section>

      <section className="band band-paper">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Вопросы</p>
            <h2>Что спрашивают собственники и шеф-инженеры</h2>
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

      <section className="band band-deep">
        <div className="wrap flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2>Пришлём расчёт комплекта под вашу кухню</h2>
            <p className="muted mt-3 max-w-[52ch]">
              Нужны тип аппаратов на линии, высота потолка и куда выходит тракт. Остальное посчитаем.
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
