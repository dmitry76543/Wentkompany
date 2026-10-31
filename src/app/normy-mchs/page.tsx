import type { Metadata } from 'next';
import Link from 'next/link';
import { ComplianceCheck } from '@/components/compliance-check';
import { TractScheme } from '@/components/tract-scheme';
import { HydroChoice } from '@/components/hydro-choice';
import { AutomationModes } from '@/components/automation-modes';
import { PageBackdrop } from '@/components/page-backdrop';
import { ClauseAnchorFlash } from '@/components/clause-anchor-flash';
import { complianceProducts, familyHref } from '@/lib/catalog';
import { rub } from '@/lib/calc';
import { norms, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Мангал и тандыр по новым нормам МЧС с 1 июля 2025',
  description:
    'Изменение № 3 к СП 7.13130.2013 (приказ МЧС № 251): пункты 5.28–5.33 о мангалах, тандырах и гидрофильтрах. ' +
    'Разбор требований, чек-лист соответствия объекта и комплект оборудования.',
  alternates: { canonical: '/normy-mchs' },
  openGraph: {
    title: 'Мангал и тандыр по новым нормам МЧС с 1 июля 2025',
    description: 'Разбор пунктов 5.28–5.33 СП 7.13130.2013 и комплект оборудования под требования.',
  },
};

const CLAUSES = [
  {
    id: '5.28',
    title: 'Схема удаления',
    text: 'Удаление продуктов горения предусматривается через дымоотвод наружу или в самостоятельный дымовой канал от вытяжного зонта над оборудованием. Прокладка дымоотводов через другие помещения не допускается.',
    closes: 'Зонт над аппаратом и отдельный тракт',
  },
  {
    id: '5.29',
    title: 'Противопожарные разрывы',
    text: 'Пол по периметру аппарата — из негорючих материалов шириной не менее 500 мм. До предметов из горючих материалов и мест хранения топлива — не менее 3,0 м; ближе только в закрытых металлических ящиках и шкафах, но не ближе 500 мм.',
    closes: 'Учитываем при замере и размещении',
  },
  {
    id: '5.30',
    title: 'Гидрофильтры и обвязка',
    text: 'Датчики температуры на входах в гидрофильтр. Световые и звуковые сигнализаторы срабатывания при 95 % от максимальной рабочей температуры и при падении давления в сети водоснабжения, размещение не далее 2 м от аппарата. Электроснабжение всех устройств, включая гидрофильтр, — по 1-й категории надёжности. Уровень звукового сигнала не менее 85 дБ на расстоянии 1 м от рабочего места.',
    closes: 'Гидрофильтр или гидрозатвор + щит автоматики',
  },
  {
    id: '5.31',
    title: 'Тракт до гидрофильтра',
    text: 'Дымоотводы на участке от улавливающих зонтов до гидрофильтра, а также дымовые каналы на всём протяжении при отсутствии гидрофильтра, должны соответствовать п. 5.11 СП и ГОСТ Р 53321.',
    closes: 'Гидрозатвор внутри зонта — участок не возникает',
  },
  {
    id: '5.32',
    title: 'Тракт после гидрофильтра',
    text: 'Воздуховоды на участке после гидрофильтра до оголовка — с пределом огнестойкости не менее EI 45 по ГОСТ Р 53299. Подключение к ним выбросных устройств систем общеобменной и местной вентиляции не допускается.',
    closes: 'Огнестойкий воздуховод в спецификации',
  },
  {
    id: '5.33',
    title: 'Вентиляторы',
    text: 'При применении вентиляторов для повышения тяги — предел огнестойкости не менее 2,0 ч при 400 °C, электроснабжение по 1-й категории надёжности.',
    closes: 'Подбор вентилятора в составе комплекта',
  },
];

const WHO = [
  'шашлычные', 'кавказская и грузинская кухня', 'чайханы и тандыр', 'дровяные пиццерии',
  'стейк-хаусы с хоспером', 'гриль-робата', 'смокеры и коптильни', 'банкетные площадки',
  'загородные комплексы', 'мангальные зоны в частных домах',
];

/** Один источник для блока вопросов на странице и для FAQPage — разметка не должна расходиться с текстом. */
const FAQ = [
  {
    q: 'С какого числа действуют новые требования к мангалам и тандырам',
    a: 'Изменение № 3 к СП 7.13130.2013 утверждено приказом МЧС России от 27.03.2025 № 251 и вступило в силу 1 июля 2025 года.',
  },
  {
    q: 'Обязателен ли гидрофильтр',
    a: 'Пункт 5.30 формулирует применение гидрофильтров как возможность. Однако при их отсутствии пункт 5.31 требует, чтобы дымовой канал соответствовал пункту 5.11 на всём протяжении, что во встроенных помещениях практически нереализуемо.',
  },
  {
    q: 'Распространяется ли требование на действующий объект',
    a: 'Свод правил применяется при проектировании и монтаже систем вновь строящихся и реконструируемых зданий. Для работающего объекта без изменений требование не включается автоматически, но возникает при реконструкции горячего цеха, смене арендатора, перепланировке и приёмке.',
  },
  {
    q: 'Чем гидрозатвор в зонте отличается от отдельного гидрофильтра',
    a: 'У гидрозатвора фильтр расположен внутри корпуса зонта. Это исключает участок воздуховода между зонтом и фильтром — тот самый, который по п. 5.31 должен соответствовать п. 5.11. Плюс компактнее и проще в монтаже.',
  },
  {
    q: 'Нужен ли щит автоматики, если гидрофильтр уже стоит',
    a: 'Да. П. 5.30 требует не только фильтр, но и датчики температуры, сигнализаторы срабатывания и падения давления воды, их размещение не далее 2 м от аппарата и электроснабжение по 1-й категории надёжности.',
  },
  {
    q: 'Какой воздуховод ставить после гидрофильтра',
    a: 'С пределом огнестойкости не ниже EI 45 по ГОСТ Р 53299 — на всём участке до оголовка, без подключения общеобменной и местной вентиляции.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: `${f.q}?`,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function NormyPage() {
  return (
    <>
      <ClauseAnchorFlash />
      <section className="band band-shop page-hero band--backdrop">
        <PageBackdrop theme="fire" />
        <div className="wrap">
          <div className="backdrop-copy max-w-[62ch]">
            <p className="lbl">
              {norms.change} к {norms.sp} · {norms.order} · в силе с {norms.inForce}
            </p>
            <h1>
              Мангал и тандыр<br />
              теперь <span style={{ color: 'var(--color-extract)' }}>по правилам МЧС</span>
            </h1>
            <p className="muted mt-6 text-lg leading-relaxed">
              Раздел 5 свода правил дополнен пунктами {norms.clauses}: впервые прямо урегулировано удаление
              продуктов горения от мангалов, тандыров и других аппаратов на твёрдом топливе.
              Ниже — что требуется и как выполнить данные требования.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#check" className="btn">Проверить объект по чек-листу</Link>
              <Link href="/configurator" className="btn btn-ghost">Собрать зонт в конфигураторе</Link>
            </div>
          </div>
          <div className="tiles mt-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
            {[
              ['Новые пункты', norms.clauses],
              ['Воздуховод после фильтра', 'EI 45'],
              ['Вентилятор', '2,0 ч / 400 °C'],
              ['Электроснабжение', '1-я категория'],
              ['Сигнал тревоги', '≥ 85 дБ / 1 м'],
            ].map(([k, v]) => (
              <div key={k} className="tile">
                <span className="lbl">{k}</span>
                <b className="num text-lg font-medium">{v}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-deep">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Требования</p>
            <h2>Шесть пунктов, которые проверяют на приёмке</h2>
            <p className="muted">
              Формулировки приведены по действующей редакции{' '}
              <a
                href={norms.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-supply)' }}
              >
                {norms.sp} с {norms.change}
              </a>
              . Перед выпуском проекта сверяйтесь с первоисточником — правоприменительная практика ещё
              формируется.
            </p>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            {CLAUSES.map((c) => (
              <article key={c.id} id={`clause-${c.id}`} className="tile clause-anchor">
                <span className="lbl" style={{ color: 'var(--color-extract)' }}>п. {c.id}</span>
                <h3>{c.title}</h3>
                <p className="muted text-sm">{c.text}</p>
                <span
                  className="mt-auto border-t pt-3 text-sm"
                  style={{ borderColor: 'var(--hair)', color: 'var(--color-supply)' }}
                >
                  Закрывается: {c.closes}
                </span>
              </article>
            ))}
          </div>

          <div
            className="mt-8 grid gap-6 border p-6 md:grid-cols-2"
            style={{ borderColor: 'var(--color-extract)', background: 'rgba(244,112,60,.13)' }}
          >
            <div>
              <h3 style={{ color: 'var(--color-extract)' }}>Почему гидрофильтр стал безальтернативным</h3>
              <p className="mt-2 text-sm text-steel-200">
                Формально п. 5.30 говорит «могут применяться» — гидрофильтр не обязателен. Но альтернативу
                задаёт п. 5.31: без гидрофильтра дымовой канал должен соответствовать п. 5.11 на всём протяжении.
              </p>
            </div>
            <div>
              <p className="muted text-sm">А это значит:</p>
              <ul className="muted mt-2 list-disc pl-4 text-sm">
                <li>вертикальные трубы без уступов;</li>
                <li>кирпич со стенкой от 120 мм, жаростойкий бетон от 60 мм, керамика или двухслойные нержавеющие трубы заводской готовности;</li>
                <li>карманы в основаниях глубиной 250 мм с отверстиями для очистки;</li>
                <li>расчёт на температуру уходящих газов до 400 °C.</li>
              </ul>
              <p className="mt-3 text-sm text-steel-200">
                Во встроенном помещении, в торговом центре или в существующем здании такую конструкцию
                собрать практически невозможно.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="band band-shop">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Схема</p>
            <h2>Как выглядит тракт целиком</h2>
            <p className="muted">
              От аппарата до оголовка: где заканчивается зона одного требования и начинается следующее.
            </p>
          </div>
          <div className="border p-6" style={{ borderColor: 'var(--hair)', background: 'var(--color-steel-900)' }}>
            <TractScheme />
          </div>
        </div>
      </section>

      <section className="band band-deep" id="vybor">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Выбор решения</p>
            <h2>Гидрозонт или гидрофильтр</h2>
            <p className="muted">
              Пункту 5.30 соответствуют оба типа оборудования. Выбор определяется не качеством очистки, а тем, сколько
              аппаратов на горячей линии и есть ли над очагом место под зонт с гидроконтуром.
            </p>
          </div>
          <HydroChoice />
        </div>
      </section>

      <section className="band band-shop" id="avtomatika">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Пункт 5.30 · автоматика</p>
            <h2>Датчики и сигнализация — как это выполняется</h2>
            <p className="muted">
              Норма требует датчиков температуры на входах в фильтр, сигнализаторов срабатывания
              при 95 % от максимальной рабочей температуры и при падении давления воды, сигнала
              не менее 85 дБ на расстоянии 1 м и питания по 1-й категории надёжности. Наш щит
              управления и диспетчеризации делает это тремя сценариями.
            </p>
          </div>
          <AutomationModes />
          <p className="hint mt-4 max-w-[76ch]">
            Электроснабжение по 1-й категории надёжности закладывается в проект электроснабжения
            объекта — это зона проектировщика, а не поставщика оборудования.
          </p>
          <Link href={familyHref('АВТ')} className="btn mt-6">Щит управления и диспетчеризации</Link>
        </div>
      </section>

      <section className="band band-deep" id="check">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Чек-лист</p>
            <h2>Проверьте объект за минуту</h2>
            <p className="muted">
              Отметьте, что уже есть. Соберём список недостающего и пришлём расчёт комплекта.
              Чек-лист не заменяет проектное решение и заключение по пожарной безопасности.
            </p>
          </div>
          <ComplianceCheck />
        </div>
      </section>

      <section className="band band-paper">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Комплект соответствия</p>
            <h2>Что производим под это требование</h2>
            <p>Цены — для эталонного типоразмера в формате «высота / ширина / глубина». Нестандарт считаем по объекту.</p>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
            {complianceProducts().map((p) => (
              <Link key={p.id} href={`/catalog/${p.slug}`} className="tile no-underline">
                <span className="lbl">
                  {p.article}
                  {p.base ? ` · ${p.base.h}/${p.base.w}/${p.base.d} мм` : ''}
                </span>
                <h3>{p.name.replace(/\s*\([^)]*\)\s*$/, '')}</h3>
                <p className="muted line-clamp-4 text-sm">{p.short || p.description}</p>
                <span
                  className="num mt-auto border-t pt-3 text-xl"
                  style={{ borderColor: 'var(--hair-l)', color: 'var(--color-steel-100)' }}
                >
                  {p.price ? `от ${rub(p.price)}` : 'после расчёта'}
                </span>
              </Link>
            ))}
          </div>
          <p className="lbl mt-6">Под требование попадают</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WHO.map((w) => (
              <span
                key={w}
                className="num border px-3 py-2 text-xs"
                style={{ borderColor: 'var(--hair-l)', color: 'var(--color-steel-600)', background: 'var(--color-sheet)' }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-shop">
        <div className="wrap">
          <div className="head">
            <p className="lbl">Вопросы проектировщиков</p>
            <h2>Что спрашивают чаще всего</h2>
          </div>
          {FAQ.map((f, i) => (
            <details key={f.q} className="faq" open={i === 0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
          <p className="lbl mt-6">
            Нормативные документы: {norms.sp} (ред. от 27.03.2025), ГОСТ Р 53321, ГОСТ Р 53299, ГОСТ Р 53302
          </p>
        </div>
      </section>

      <section className="band band-deep">
        <div className="wrap flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[52ch]">
            <h2>Проверим объект и посчитаем комплект</h2>
            <p className="muted mt-3">
              Пришлите планировку и тип очага — вернём схему тракта по пп. {norms.clauses} и спецификацию с ценой.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contacts" className="btn">Отправить заявку</Link>
            <a href={site.phoneHref} className="btn btn-ghost num">{site.phone}</a>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </>
  );
}
