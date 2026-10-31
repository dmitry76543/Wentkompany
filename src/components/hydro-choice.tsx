import Link from 'next/link';
import { ClauseRichText } from '@/components/clause-tip';
import { familyHref, priceFrom } from '@/lib/catalog';
import { rub } from '@/lib/calc';

/**
 * Гидрозонт или гидрофильтр — когда что.
 *
 * Производство формулирует это как преимущества гидрозонта: он исключает
 * возгорание участка воздуховода от зонта до фильтра, компактнее, дешевле
 * и проще в установке. Первый пункт — не маркетинг, а прямое следствие
 * п. 5.31 СП: участка «зонт → фильтр» просто не возникает, когда фильтрация
 * внутри зонта.
 *
 * Но это не значит, что гидрофильтр хуже: у него своя область применения —
 * несколько аппаратов на общий тракт и объекты, где зонт уже стоит. Поэтому
 * блок написан как выбор с границей применимости, а не как сравнение
 * «лучше — хуже»: посетитель должен уйти с решением, а не с сомнением
 * в одном из двух наших изделий.
 */

const HYDRO_HOOD = [
  'Фильтрация внутри зонта: участка воздуховода «зонт → фильтр» не возникает вовсе, а по п. 5.31 именно он требует соответствия п. 5.11 СП и ГОСТ Р 53321.',
  'Занимает место только над аппаратом — отдельного места в помещении не нужно.',
  'Один аппарат: мангал, тандыр или хоспер, над которым есть куда встать зонту.',
  'Дешевле и проще в монтаже: одно изделие вместо двух и одна точка подключения воды.',
];

const HYDRO_FILTER = [
  'Ставится открыто в том же помещении, что и аппарат, — по п. 5.30 это допускается прямо.',
  'Собирает несколько аппаратов на общий тракт: одна фильтрация на всю горячую линию.',
  'Подходит, когда зонт над аппаратом уже стоит и менять его не планируют.',
  'Работает там, где над аппаратом нет места под зонт с гидроконтуром.',
];

export function HydroChoice({ compact = false }: { compact?: boolean }) {
  const hood = priceFrom('ЗВПГ');
  const filter = priceFrom('ГФ');

  return (
    <div>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        <article className="tile">
          <span className="lbl" style={{ color: 'var(--color-extract)' }}>Зонт с гидрозатвором</span>
          <h3 style={{ textTransform: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1.05rem' }}>
            Один очаг, место над ним есть
          </h3>
          <ul className="muted flex list-disc flex-col gap-2 pl-4 text-sm">
            {HYDRO_HOOD.map((t) => (
              <li key={t}>
                <ClauseRichText text={t} />
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap items-baseline gap-3 border-t pt-3" style={{ borderColor: 'var(--hair)' }}>
            <span className="num text-lg">{hood ? `от ${rub(hood)}` : 'после расчёта'}</span>
            <Link href={familyHref('ЗВПГ')} style={{ color: 'var(--color-supply)' }}>ЗВПГ и ЗВОГ</Link>
          </div>
        </article>

        <article className="tile">
          <span className="lbl" style={{ color: 'var(--color-supply)' }}>Гидрофильтр</span>
          <h3 style={{ textTransform: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '1.05rem' }}>
            Несколько аппаратов или зонт уже стоит
          </h3>
          <ul className="muted flex list-disc flex-col gap-2 pl-4 text-sm">
            {HYDRO_FILTER.map((t) => (
              <li key={t}>
                <ClauseRichText text={t} />
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap items-baseline gap-3 border-t pt-3" style={{ borderColor: 'var(--hair)' }}>
            <span className="num text-lg">{filter ? `от ${rub(filter)}` : 'после расчёта'}</span>
            <Link href={familyHref('ГФ')} style={{ color: 'var(--color-supply)' }}>Гидрофильтр ГФ</Link>
          </div>
        </article>
      </div>

      {!compact && (
        <p className="hint mt-4 max-w-[76ch]">
          <ClauseRichText
            text={
              'Оба решения соответствуют п. 5.30 и оба требуют щита с датчиками температуры и ' +
              'сигнализаторами давления воды. Разница — в границах применимости, а не в качестве ' +
              'очистки: если сомневаетесь, пришлите состав горячей линии и высоту потолка, ' +
              'посчитаем оба варианта и покажем разницу в деньгах.'
            }
          />
        </p>
      )}
    </div>
  );
}
