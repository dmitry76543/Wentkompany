import { NextResponse } from 'next/server';
import { deliverLeadToMax, normalizeMaxToken } from '@/lib/max-delivery';
import { formatPhone, isValidPhone } from '@/lib/phone';
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

  async function assertDelivered(res: Response, label: string) {
    const body = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`${label}: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    // Telegram/MAX часто отдают 200 с { ok: false, … }
    try {
      const json = JSON.parse(body) as { ok?: boolean; error?: string; description?: string };
      if (json && json.ok === false) {
        throw new Error(`${label}: ${json.error || json.description || body.slice(0, 200)}`);
      }
    } catch (e) {
      if (e instanceof SyntaxError) return; // не JSON (например, sendDocument)
      throw e;
    }
  }

  const tasks: Promise<unknown>[] = [];

  // Telegram Bot API — текст + вложения (секреты только в env)
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChats = splitIds(
    process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID,
  );
  if (tgToken && tgChats.length > 0) {
    for (const chat of tgChats) {
      tasks.push(
        fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
        }).then((res) => assertDelivered(res, `telegram ${chat}`)),
      );
      for (const upload of uploads) {
        if (!upload.bytes || !upload.meta || !upload.filename) continue;
        const form = new FormData();
        form.set('chat_id', chat);
        form.set(
          'document',
          new Blob([new Uint8Array(upload.bytes)], { type: upload.meta.mime }),
          upload.filename,
        );
        tasks.push(
          fetch(`https://api.telegram.org/bot${tgToken}/sendDocument`, {
            method: 'POST',
            body: form,
          }).then((res) => assertDelivered(res, `telegram-doc ${chat}`)),
        );
      }
    }
  }

  // MAX Bot API: сначала текст, затем файлы (/uploads → attachments)
  const maxToken = normalizeMaxToken(process.env.MAX_BOT_TOKEN || '');
  const maxRecipients = splitIds(process.env.MAX_RECIPIENT_IDS);
  if (maxToken && maxRecipients.length > 0) {
    tasks.push(
      deliverLeadToMax({
        accessToken: maxToken,
        userIds: maxRecipients,
        text,
        files: uploads.flatMap((u) =>
          u.bytes && u.meta && u.filename
            ? [{ ok: true as const, bytes: u.bytes, meta: u.meta, filename: u.filename }]
            : [],
        ),
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
      fetch(process.env.CRM_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lead,
          drawing: fileNames[0] ?? null,
          drawings: fileNames,
        }),
      }).then((res) => assertDelivered(res, 'crm')),
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
