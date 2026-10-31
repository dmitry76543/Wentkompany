/**
 * Доставка в MAX Bot API: текст и файлы.
 * Секрет — только Authorization из MAX_BOT_TOKEN (не в git / NEXT_PUBLIC).
 * Документация: https://dev.max.ru/docs-api
 */

import type { UploadCheck } from '@/lib/upload';

const MAX_API = 'https://platform-api2.max.ru';

type ReadyUpload = Required<Pick<UploadCheck, 'bytes' | 'meta' | 'filename'>> & { ok: true };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** jpg/png/heic → image; остальное (pdf, dxf, webp) → file. */
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

/** Шаг 1–2: получить URL и залить файл → token для attachments. */
export async function maxUploadMedia(
  accessToken: string,
  file: ReadyUpload,
): Promise<{ type: 'image' | 'file'; token: string }> {
  const type = uploadType(file.meta);
  const initRes = await fetch(`${MAX_API}/uploads?type=${type}`, {
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
    headers: { Authorization: accessToken },
    body: form,
  });
  const upBody = await readJson(upRes);
  if (!upRes.ok) {
    throw new Error(`MAX upload file: HTTP ${upRes.status} ${JSON.stringify(upBody).slice(0, 200)}`);
  }

  // Ответ image: { token } или вложенный photos; file: { fileId, token }
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
  accessToken: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${MAX_API}/messages?user_id=${encodeURIComponent(userId)}`;
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1)); // 0.5s, 1s, 2s, 4s
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

/** Текст заявки + каждое вложение отдельным сообщением (лимит API: один file за раз). */
export async function deliverLeadToMax(opts: {
  accessToken: string;
  userIds: string[];
  text: string;
  files: ReadyUpload[];
}): Promise<void> {
  const { accessToken, userIds, text, files } = opts;

  // Токены файлов общие для всех получателей
  const media: { type: 'image' | 'file'; token: string; name: string }[] = [];
  for (const file of files) {
    const uploaded = await maxUploadMedia(accessToken, file);
    media.push({ ...uploaded, name: file.filename });
  }

  for (const userId of userIds) {
    await maxPostMessage(accessToken, userId, { text, notify: true });
    for (const m of media) {
      await maxPostMessage(accessToken, userId, {
        text: `📎 ${m.name}`,
        notify: true,
        attachments: [
          {
            type: m.type,
            payload: { token: m.token },
          },
        ],
      });
    }
  }
}
