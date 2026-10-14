import fs from 'fs';
import path from 'path';
import { sanitizeFilename } from '@/lib/security/input-sanitizer';
import { uploadBlob, downloadBlob, blobExists } from './azure-blob';

export const ALLOWED_BUG_SCREENSHOT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
] as const;

export const MAX_BUG_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface ScreenshotValidationResult {
  valid: boolean;
  error?: string;
  ext?: string;
}

export function validateScreenshotFile(
  mimeType: string,
  sizeBytes: number,
  originalFilename?: string
): ScreenshotValidationResult {
  if (
    !ALLOWED_BUG_SCREENSHOT_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_BUG_SCREENSHOT_MIME_TYPES)[number]
    )
  ) {
    return {
      valid: false,
      error: 'Invalid file format. Allowed screenshot image formats: JPG, PNG, WEBP.',
    };
  }

  if (sizeBytes > MAX_BUG_SCREENSHOT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Screenshot file size exceeds 5MB limit (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  let ext = '.png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') ext = '.jpg';
  else if (mimeType === 'image/png') ext = '.png';
  else if (mimeType === 'image/webp') ext = '.webp';
  else if (originalFilename) {
    const cleanFilename = sanitizeFilename(originalFilename);
    const rawExt = path.extname(cleanFilename).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(rawExt)) {
      ext = rawExt;
    }
  }

  return { valid: true, ext };
}

export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return true;
  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}

const LOCAL_BUG_DIR = path.join(process.cwd(), 'uploads', 'bug-reports');

function ensureLocalBugDir(): void {
  if (!fs.existsSync(LOCAL_BUG_DIR)) {
    fs.mkdirSync(LOCAL_BUG_DIR, { recursive: true });
  }
}

export async function saveBugReportScreenshot(
  buffer: Buffer,
  mimeType: string,
  originalFilename?: string
): Promise<{ url: string; filename: string }> {
  const validation = validateScreenshotFile(mimeType, buffer.length, originalFilename);
  if (!validation.valid || !validation.ext) {
    throw new Error(validation.error || 'Invalid screenshot file');
  }

  if (!validateImageMagicBytes(buffer)) {
    throw new Error('Screenshot file content does not match allowed image formats.');
  }

  const uniqueId = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const uniqueFilename = `bug-${uniqueId}${validation.ext}`;
  const blobPath = `bug-reports/${uniqueFilename}`;

  try {
    await uploadBlob({
      blobPath,
      buffer,
      mimeType,
      metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      url: `/api/uploads/bug-reports/${uniqueFilename}`,
      filename: uniqueFilename,
    };
  } catch (azureError) {
    console.warn(
      '[BugStorage] Azure upload fallback to local storage:',
      (azureError as Error).message
    );
    ensureLocalBugDir();
    const localFilePath = path.join(LOCAL_BUG_DIR, uniqueFilename);
    fs.writeFileSync(localFilePath, buffer);

    return {
      url: `/api/uploads/bug-reports/${uniqueFilename}`,
      filename: uniqueFilename,
    };
  }
}

export async function getBugReportScreenshotBuffer(
  filename: string
): Promise<{ buffer: Buffer; mimeType: string; contentLength: number }> {
  const clean = sanitizeFilename(filename);
  const blobPath = `bug-reports/${clean}`;

  let mimeType = 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) mimeType = 'image/jpeg';
  else if (clean.endsWith('.webp')) mimeType = 'image/webp';

  try {
    const exists = await blobExists({ blobPath });
    if (exists) {
      const res = await downloadBlob({ blobPath });
      return {
        buffer: res.buffer,
        mimeType: res.mimeType || mimeType,
        contentLength: res.contentLength,
      };
    }
  } catch {
    // Fall back to local disk
  }

  const localFilePath = path.join(LOCAL_BUG_DIR, clean);
  if (fs.existsSync(localFilePath)) {
    const buffer = fs.readFileSync(localFilePath);
    return {
      buffer,
      mimeType,
      contentLength: buffer.length,
    };
  }

  throw new Error(`Bug report screenshot not found: ${clean}`);
}
