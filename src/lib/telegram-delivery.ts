/**
 * Доставка в Telegram Bot API: текст, затем документы.
 * Секрет — TELEGRAM_BOT_TOKEN (не в git / NEXT_PUBLIC).
 * https://core.telegram.org/bots/api
 */

import type { UploadCheck } from '@/lib/upload';

type ReadyUpload = Required<Pick<UploadCheck, 'bytes' | 'meta' | 'filename'>> & { ok: true };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function normalizeTelegramToken(raw: string): string {
  return raw.trim().replace(/^bot/i, '');
}

async function assertTelegramOk(res: Response, label: string): Promise<void> {
  const body = await res.text().catch(() => '');
  let json: { ok?: boolean; description?: string; error_code?: number } = {};
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${body.slice(0, 200)}`);
    return;
  }
  if (!res.ok || json.ok === false) {
    throw new Error(
      `${label}: HTTP ${res.status} ${json.description || body.slice(0, 200)}`,
    );
  }
}

async function tgFetch(
  token: string,
  method: string,
  init: RequestInit,
  label: string,
): Promise<void> {
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(400 * 2 ** (attempt - 1));
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, init);
      // 429 / 5xx — повторить
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        const retryAfter = Number(res.headers.get('retry-after') || 0);
        if (retryAfter > 0 && retryAfter < 30) await sleep(retryAfter * 1000);
        continue;
      }
      await assertTelegramOk(res, label);
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      // сетевые сбои — ещё попытка
      if (attempt < 3 && /fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(lastErr)) {
        continue;
      }
      throw e instanceof Error ? e : new Error(lastErr);
    }
  }
  throw new Error(`${label}: ${lastErr}`);
}

/** Текст всем чатам, затем каждый файл (sendDocument). */
export async function deliverLeadToTelegram(opts: {
  botToken: string;
  chatIds: string[];
  text: string;
  files: ReadyUpload[];
}): Promise<{ textOk: number; filesOk: number }> {
  const token = normalizeTelegramToken(opts.botToken);
  if (!token) throw new Error('telegram: пустой TELEGRAM_BOT_TOKEN');
  if (opts.chatIds.length === 0) throw new Error('telegram: пустой TELEGRAM_CHAT_ID');

  let textOk = 0;
  for (const chatId of opts.chatIds) {
    await tgFetch(
      token,
      'sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: opts.text,
          disable_web_page_preview: true,
        }),
      },
      `telegram ${chatId}`,
    );
    textOk += 1;
  }

  let filesOk = 0;
  const fileErrors: string[] = [];
  for (const file of opts.files) {
    try {
      for (const chatId of opts.chatIds) {
        const form = new FormData();
        form.set('chat_id', chatId);
        form.set(
          'document',
          new File([new Uint8Array(file.bytes)], file.filename, {
            type: file.meta.mime,
          }),
        );
        await tgFetch(
          token,
          'sendDocument',
          { method: 'POST', body: form },
          `telegram-doc ${chatId}`,
        );
      }
      filesOk += 1;
    } catch (e) {
      fileErrors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (opts.files.length > 0 && filesOk === 0) {
    console.error('[telegram] текст ушёл, файлы нет:', fileErrors);
  } else if (fileErrors.length) {
    console.error('[telegram] часть файлов не ушла:', fileErrors);
  }

  return { textOk, filesOk };
}
