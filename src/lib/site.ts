/** Единый источник контактов и реквизитов. */
export const site = {
  name: 'FortInox',
  legalName: 'FortInox',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://fortinox.ru',
  phone: '+7 (995) 158-44-70',
  phoneHref: 'tel:+79951584470',
  email: 'fortinox@yandex.ru',
  address: 'Москва и Московская область',
  hours: 'Пн–Пт 10:00–19:00',
  description:
    'Производство гидрозонтов, гидрофильтров и вытяжных зонтов из нержавеющей стали. ' +
    'Решения под требования Изменения № 3 к СП 7.13130.2013 для мангалов и тандыров.',
  messengers: {
    max: 'https://max.ru/u/f9LHodD0cOJslSuElobewW_frHCqrR7nP6vihGTkiJqpviX4pz-VYyE1t4s',
    telegram: 'https://t.me/+79951584470',
    whatsapp: 'https://wa.me/79951584470',
  },
} as const;

/** Нормативная база — используется на посадочной и в FAQ. */
export const norms = {
  order: 'Приказ МЧС России от 27.03.2025 № 251',
  sp: 'СП 7.13130.2013',
  change: 'Изменение № 3',
  inForce: '01.07.2025',
  clauses: '5.28–5.33',
  /** Первоисточник на docs.cntd.ru */
  sourceUrl: 'https://docs.cntd.ru/document/1312658782',
  /** Якорь блока пп. 5.28–5.33 в том же документе */
  clausesUrl: 'https://docs.cntd.ru/document/1312658782#7E80KE',
} as const;
