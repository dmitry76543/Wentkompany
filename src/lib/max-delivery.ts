/**
 * Доставка в MAX Bot API: текст и файлы.
 * Секрет — только Authorization из MAX_BOT_TOKEN (не в git / NEXT_PUBLIC).
 * https://dev.max.ru/docs-api
 */

import type { UploadCheck } from '@/lib/upload';

/** Сначала api2 (актуальный), затем прежний хост — как в KodBuster. */
const MAX_API_HOSTS = [
  'https://platform-api2.max.ru',
  'https://platform-api.max.ru',
] as const;

type ReadyUpload = Required<Pick<UploadCheck, 'bytes' | 'meta' | 'filename'>> & { ok: true };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function uploadType(meta: ReadyUpload['meta']): 'image' | 'file' {
  if (meta.kind === 'photo' && (meta.ext === 'jpg' || meta.ext === 'png')) return 'image';
  if (meta.ext === 'heic') return 'image';
  return 'file';
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`MAX: не JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

async function maxUploadMedia(
  apiBase: string,
  accessToken: string,
  file: ReadyUpload,
): Promise<{ type: 'image' | 'file'; token: string }> {
  const type = uploadType(file.meta);
  const initRes = await fetch(`${apiBase}/uploads?type=${type}`, {
    method: 'POST',
    headers: {
      Authorization: accessToken,
      Accept: 'application/json',
    },
  });
  const initBody = await readJson(initRes);
  if (!initRes.ok) {
    throw new Error(`MAX uploads: HTTP ${initRes.status} ${JSON.stringify(initBody).slice(0, 200)}`);
  }
  const url = typeof initBody.url === 'string' ? initBody.url : '';
  if (!url) throw new Error('MAX uploads: нет url для загрузки');

  const form = new FormData();
  form.set(
    'data',
    new Blob([new Uint8Array(file.bytes)], { type: file.meta.mime }),
    file.filename,
  );
  const upRes = await fetch(url, {
    method: 'POST',
    // часть CDN не принимает Authorization на upload URL
    body: form,
  });
  const upBody = await readJson(upRes);
  if (!upRes.ok) {
    throw new Error(`MAX upload file: HTTP ${upRes.status} ${JSON.stringify(upBody).slice(0, 200)}`);
  }

  let token = typeof upBody.token === 'string' ? upBody.token : '';
  if (!token && upBody.photos && typeof upBody.photos === 'object') {
    const photos = upBody.photos as Record<string, { token?: string }>;
    const first = Object.values(photos)[0];
    token = first?.token ?? '';
  }
  if (!token) throw new Error('MAX upload: в ответе нет token');
  return { type, token };
}

async function maxPostMessage(
  apiBase: string,
  accessToken: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${apiBase}/messages?user_id=${encodeURIComponent(userId)}`;
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* plain */
    }
    const code = typeof json.code === 'string' ? json.code : '';
    if (res.ok && json.ok !== false && code !== 'attachment.not.ready') return;
    if (code === 'attachment.not.ready' || /not\.ready|not.processed/i.test(raw)) {
      lastErr = raw.slice(0, 200);
      continue;
    }
    throw new Error(`MAX message ${userId}: HTTP ${res.status} ${raw.slice(0, 200)}`);
  }
  throw new Error(`MAX message ${userId}: вложение не готово (${lastErr})`);
}

/** Выбрать рабочий API-хост по простой текстовой отправке. */
async function resolveApiBase(accessToken: string, userId: string, text: string): Promise<string> {
  const errors: string[] = [];
  for (const host of MAX_API_HOSTS) {
    try {
      await maxPostMessage(host, accessToken, userId, { text, notify: true });
      return host;
    } catch (e) {
      errors.push(`${host}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`MAX: не удалось отправить текст. ${errors.join(' | ')}`);
}

/**
 * Сначала текст (чтобы заявка дошла даже при сбое файла),
 * затем вложения. Нужен числовой user_id; пользователь должен
 * хотя бы раз написать боту / открыть диалог.
 */
export async function deliverLeadToMax(opts: {
  accessToken: string;
  userIds: string[];
  text: string;
  files: ReadyUpload[];
}): Promise<{ textOk: number; filesOk: number }> {
  const { accessToken, userIds, text, files } = opts;
  if (userIds.length === 0) throw new Error('MAX: пустой MAX_RECIPIENT_IDS');

  const primary = userIds[0]!;
  const apiBase = await resolveApiBase(accessToken, primary, text);
  let textOk = 1;

  for (const userId of userIds.slice(1)) {
    await maxPostMessage(apiBase, accessToken, userId, { text, notify: true });
    textOk += 1;
  }

  let filesOk = 0;
  const fileErrors: string[] = [];
  for (const file of files) {
    try {
      const uploaded = await maxUploadMedia(apiBase, accessToken, file);
      for (const userId of userIds) {
        await maxPostMessage(apiBase, accessToken, userId, {
          text: `📎 ${file.filename}`,
          notify: true,
          attachments: [
            {
              type: uploaded.type,
              payload: { token: uploaded.token },
            },
          ],
        });
      }
      filesOk += 1;
    } catch (e) {
      fileErrors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (files.length > 0 && filesOk === 0) {
    console.error('[max] текст ушёл, файлы нет:', fileErrors);
  }
  if (fileErrors.length && filesOk > 0) {
    console.error('[max] часть файлов не ушла:', fileErrors);
  }

  return { textOk, filesOk };
}
