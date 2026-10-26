import path from 'node:path';

export type DetectedFileType = 'pdf' | 'jpeg' | 'png' | 'text' | 'unknown';

/**
 * Validate uploaded content by magic bytes, not the client-supplied mimetype.
 * Text files have no reliable signature; they are accepted only when the
 * declared mimetype is text/plain and the content decodes as UTF-8.
 */
export function detectFileType(buffer: Buffer, declaredMime?: string): DetectedFileType {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  if (declaredMime === 'text/plain') {
    const sample = buffer.subarray(0, 4096);
    if (!sample.includes(0)) {
      const decoded = sample.toString('utf8');
      if (!decoded.includes('\uFFFD')) return 'text';
    }
  }

  return 'unknown';
}

export function isTextLike(type: DetectedFileType): boolean {
  return type === 'text';
}

export function isImage(type: DetectedFileType): boolean {
  return type === 'jpeg' || type === 'png';
}

/** Keep only a safe basename; never trust originalname. */
export function sanitizeFileName(original: string | undefined, fallback = 'document'): string {
  const base = path.basename(original ?? '').replace(/[^\w.\- ()]/g, '_').trim();
  const cleaned = base.replace(/^\.+/, '').slice(0, 120);
  return cleaned || fallback;
}

export function imageMime(type: DetectedFileType): 'image/jpeg' | 'image/png' {
  return type === 'png' ? 'image/png' : 'image/jpeg';
}
