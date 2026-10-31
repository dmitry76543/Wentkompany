import { NextResponse } from 'next/server';
import { deliverLeadToMax, normalizeMaxToken } from '@/lib/max-delivery';
import { formatPhone, isValidPhone } from '@/lib/phone';
import { deliverLeadToTelegram, normalizeTelegramToken } from '@/lib/telegram-delivery';
import { checkUpload } from '@/lib/upload';

/**
 * Приём заявки: Telegram, MAX (Bot API) и вебхук CRM.
 *
 * Секреты только на сервере (см. .env.example) — в NEXT_PUBLIC_* и git не кладём:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *   MAX_BOT_TOKEN, MAX_RECIPIENT_IDS
 *   CRM_WEBHOOK_URL
 * Без каналов роут пишет заявку в лог и отвечает успехом (стенд).
 *
 * multipart/form-data: до трёх чертежей (drawing). Файлы не пишутся на диск —
 * уходят в Telegram и в MAX (upload → attachment).
 */

export const runtime = 'nodejs';

function splitIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Lead {
  name?: string;
  phone?: string;
  object?: string;
  task?: string;
  configuration?: string;
  page?: string;
  company?: string; // honeypot
  consent?: string;
}

const RATE = new Map<string, { count: number; reset: number }>();
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FILES = 3;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = RATE.get(ip);
  if (!entry || now > entry.reset) {
    RATE.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

const clean = (v: unknown, max = 300) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Слишком много заявок подряд. Попробуйте позже.' }, { status: 429 });
  }

  const type = request.headers.get('content-type') || '';
  let body: Lead;
  let rawFiles: File[] = [];

  try {
    if (type.includes('multipart/form-data')) {
      const form = await request.formData();
      body = Object.fromEntries(
        [...form.entries()].filter(([, v]) => typeof v === 'string'),
      ) as Lead;
      rawFiles = form
        .getAll('drawing')
        .filter((v): v is File => v instanceof File && v.size > 0)
        .slice(0, MAX_FILES);
    } else {
      body = (await request.json()) as Lead;
    }
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  if (body.company) return NextResponse.json({ ok: true }); // бот
  if (!body.consent) {
    return NextResponse.json({ error: 'Нужно согласие на обработку персональных данных' }, { status: 400 });
  }

  const lead = {
    name: clean(body.name, 80),
    phone: clean(body.phone, 30),
    object: clean(body.object, 120),
    task: clean(body.task, 1200),
    configuration: clean(body.configuration, 1200),
    page: clean(body.page, 200),
    at: new Date().toISOString(),
  };

  if (!lead.name) {
    return NextResponse.json({ error: 'Укажите имя' }, { status: 400 });
  }
  if (!isValidPhone(lead.phone)) {
    return NextResponse.json(
      { error: 'Введите полный телефонный номер' },
      { status: 400 },
    );
  }
  lead.phone = formatPhone(lead.phone);

  // Файлы проверяем по первым байтам: заявленный тип подделывается тривиально
  const uploads: NonNullable<Awaited<ReturnType<typeof checkUpload>> & { ok: true }>[] = [];
  for (const file of rawFiles) {
    const checked = await checkUpload(file);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    uploads.push(checked as typeof checked & { ok: true });
  }

  const fileNames = uploads.map((u) => u.filename).filter(Boolean) as string[];
  const text =
    `📩 Заявка с сайта «FortInox»\n` +
    `\n` +
    `👤 Имя: ${lead.name}\n` +
    `📞 Телефон: ${lead.phone}\n` +
    `🏭 Объект: ${lead.object || '—'}\n` +
    `💬 Задача: ${lead.task || '—'}\n` +
    (lead.configuration ? `⚙️ Конфигурация: ${lead.configuration}\n` : '') +
    (fileNames.length
      ? `📎 Файлы (${fileNames.length}): ${fileNames.join(', ')}\n`
      : '') +
    `🔗 Страница: ${lead.page || '/'}`;

  const readyFiles = uploads.flatMap((u) =>
    u.bytes && u.meta && u.filename
      ? [{ ok: true as const, bytes: u.bytes, meta: u.meta, filename: u.filename }]
      : [],
  );

  const tgToken = normalizeTelegramToken(process.env.TELEGRAM_BOT_TOKEN || '');
  const tgChats = splitIds(
    process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID,
  );
  const maxToken = normalizeMaxToken(process.env.MAX_BOT_TOKEN || '');
  const maxRecipients = splitIds(process.env.MAX_RECIPIENT_IDS);

  const tasks: Promise<unknown>[] = [];

  // Telegram: один канал (текст → файлы), токен без пробелов/«bot»
  if (tgToken && tgChats.length > 0) {
    tasks.push(
      deliverLeadToTelegram({
        botToken: tgToken,
        chatIds: tgChats,
        text,
        files: readyFiles,
      }).then((r) => {
        console.info('[lead] Telegram ok', r);
        return r;
      }),
    );
  } else if (maxToken && maxRecipients.length > 0) {
    console.warn(
      '[lead] Telegram не настроен (нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID). Заявка уйдёт только в MAX.',
    );
  }

  // MAX: текст, затем файлы
  if (maxToken && maxRecipients.length > 0) {
    tasks.push(
      deliverLeadToMax({
        accessToken: maxToken,
        userIds: maxRecipients,
        text,
        files: readyFiles,
      }).then((r) => {
        console.info('[lead] MAX ok', r);
        return r;
      }),
    );
  } else if (tgToken && tgChats.length > 0) {
    console.warn(
      '[lead] MAX не настроен (нужны MAX_BOT_TOKEN и MAX_RECIPIENT_IDS — числовые user_id, не ссылка max.ru/u/…). Заявка ушла только в Telegram.',
    );
  }

  if (process.env.CRM_WEBHOOK_URL) {
    tasks.push(
      (async () => {
        const res = await fetch(process.env.CRM_WEBHOOK_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...lead,
            drawing: fileNames[0] ?? null,
            drawings: fileNames,
          }),
        });
        const body = await res.text().catch(() => '');
        if (!res.ok) throw new Error(`crm: HTTP ${res.status} ${body.slice(0, 200)}`);
      })(),
    );
  }

  if (tasks.length === 0) {
    console.info('[lead] интеграции не настроены, заявка только в логе:', {
      ...lead,
      drawings: uploads.map((u) => `${u.filename} (${u.bytes!.length} Б)`),
    });
    return NextResponse.json({ ok: true, delivered: 'log' });
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed.length === results.length) {
    console.error(
      '[lead] доставка не удалась',
      failed.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))),
      lead,
    );
    return NextResponse.json({ error: 'Не удалось передать заявку. Позвоните, пожалуйста.' }, { status: 502 });
  }
  if (failed.length > 0) {
    const reasons = failed.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason)));
    console.error('[lead] частичная доставка', reasons);
    // Клиенту — ок (Telegram мог уйти), в ответе — подсказка для отладки
    return NextResponse.json({
      ok: true,
      delivered: results.length - failed.length,
      partial: true,
      failedChannels: reasons.map((m) => (m.startsWith('MAX') ? 'max' : m.startsWith('Telegram') || m.includes('telegram') ? 'telegram' : 'other')),
      debug: reasons.map((m) => m.slice(0, 180)),
    });
  }

  return NextResponse.json({
    ok: true,
    delivered: results.length,
    maxConfigured: Boolean(maxToken && maxRecipients.length > 0),
  });
}
