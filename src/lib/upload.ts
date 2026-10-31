/**
 * Проверка приложенного к заявке файла.
 *
 * Заявленный браузером Content-Type подделывается тривиально, поэтому тип
 * определяется по первым байтам файла и должен совпасть с расширением.
 * Файл нигде не сохраняется: пересылается в Telegram / MAX и забывается —
 * на сервере не остаётся ни каталога с чужими чертежами, ни лишних
 * обязанностей по 152-ФЗ.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type UploadKind = 'photo' | 'document';

interface Sniffed {
  ext: string;
  mime: string;
  kind: UploadKind;
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) =>
  sig.every((v, i) => b[at + i] === v);

/** Определяет формат по сигнатуре. null — формат не из списка разрешённых. */
export function sniff(bytes: Uint8Array): Sniffed | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ext: 'jpg', mime: 'image/jpeg', kind: 'photo' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { ext: 'png', mime: 'image/png', kind: 'photo' };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { ext: 'webp', mime: 'image/webp', kind: 'photo' };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { ext: 'pdf', mime: 'application/pdf', kind: 'document' };

  // HEIC/HEIF — обычный формат снимков с айфона: 'ftyp' на 4-м байте
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand))
      return { ext: 'heic', mime: 'image/heic', kind: 'document' };
  }

  // DXF — текстовый формат: начинается с группы 0 и слова SECTION
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 256));
  if (/^\s*0\s+SECTION/.test(head) || /^\s*999\b/.test(head))
    return { ext: 'dxf', mime: 'application/dxf', kind: 'document' };

  return null;
}

export interface UploadCheck {
  ok: boolean;
  error?: string;
  bytes?: Uint8Array;
  meta?: Sniffed;
  filename?: string;
}

/** Безопасное имя файла: без путей, кириллицы и управляющих символов. */
export function safeName(original: string, ext: string): string {
  const base = original
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .replace(/\.[^.]*$/, '')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .slice(0, 60);
  return `${base || 'chertyozh'}.${ext}`;
}

export async function checkUpload(file: File): Promise<UploadCheck> {
  if (file.size === 0) return { ok: false, error: 'Файл пустой' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'Файл больше 10 МБ. Пришлите чертёж почтой или в мессенджере.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = sniff(bytes);
  if (!meta) {
    return {
      ok: false,
      error: 'Принимаем фото, PDF и DXF. Другие форматы — почтой или в мессенджере.',
    };
  }

  return { ok: true, bytes, meta, filename: safeName(file.name || '', meta.ext) };
}
