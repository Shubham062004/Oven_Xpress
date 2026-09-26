import fs from 'fs';
import path from 'path';
import { sanitizeFilename } from '@/lib/security/input-sanitizer';
import {
  uploadBlob,
  downloadBlob,
  deleteBlob,
  blobExists,
} from './azure-blob';

export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
] as const;

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface AvatarValidationResult {
  valid: boolean;
  error?: string;
  ext?: string;
}

export function validateAvatarFile(
  mimeType: string,
  sizeBytes: number,
  originalFilename?: string
): AvatarValidationResult {
  if (!ALLOWED_AVATAR_MIME_TYPES.includes(mimeType as (typeof ALLOWED_AVATAR_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: 'Invalid file format. Allowed image formats: JPG, JPEG, PNG, WEBP',
    };
  }

  if (sizeBytes > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: `Avatar file size exceeds 2MB limit (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB)`,
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

/**
 * Validates image magic bytes to prevent MIME spoofing.
 */
export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}

const LOCAL_AVATAR_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

function ensureLocalAvatarDir(): void {
  if (!fs.existsSync(LOCAL_AVATAR_DIR)) {
    fs.mkdirSync(LOCAL_AVATAR_DIR, { recursive: true });
  }
}

/**
 * Uploads an avatar image to Azure Blob Storage (with local fallback).
 */
export async function saveAvatarBuffer(
  buffer: Buffer,
  mimeType: string,
  userId: string,
  originalFilename?: string
): Promise<{ url: string; filename: string }> {
  const validation = validateAvatarFile(mimeType, buffer.length, originalFilename);
  if (!validation.valid || !validation.ext) {
    throw new Error(validation.error || 'Invalid avatar file');
  }

  if (!validateImageMagicBytes(buffer)) {
    throw new Error('File content does not match allowed image formats.');
  }

  const safeUserId = sanitizeFilename(userId).replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueFilename = `avatar-${safeUserId}-${Date.now()}${validation.ext}`;
  const blobPath = `avatars/${uniqueFilename}`;

  try {
    await uploadBlob({
      blobPath,
      buffer,
      mimeType,
      metadata: {
        userId: safeUserId,
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      url: `/api/uploads/avatar/${uniqueFilename}`,
      filename: uniqueFilename,
    };
  } catch (azureError) {
    console.warn('[AvatarStorage] Azure upload fallback to local storage:', (azureError as Error).message);
    ensureLocalAvatarDir();
    const localFilePath = path.join(LOCAL_AVATAR_DIR, uniqueFilename);
    fs.writeFileSync(localFilePath, buffer);

    return {
      url: `/api/uploads/avatar/${uniqueFilename}`,
      filename: uniqueFilename,
    };
  }
}

/**
 * Retrieves an avatar image buffer.
 */
export async function getAvatarBuffer(
  filename: string
): Promise<{ buffer: Buffer; mimeType: string; contentLength: number }> {
  const clean = sanitizeFilename(filename);
  const blobPath = `avatars/${clean}`;

  let mimeType = 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) mimeType = 'image/jpeg';
  else if (clean.endsWith('.webp')) mimeType = 'image/webp';

  // 1. Try Azure Blob Storage
  try {
    const exists = await blobExists({ blobPath });
    if (exists) {
      const downloaded = await downloadBlob({ blobPath });
      return {
        buffer: downloaded.buffer,
        mimeType: downloaded.mimeType || mimeType,
        contentLength: downloaded.contentLength,
      };
    }
  } catch (azureError) {
    console.warn('[AvatarStorage] Azure download failed, trying local fallback:', (azureError as Error).message);
  }

  // 2. Try local disk fallback
  const localFilePath = path.join(LOCAL_AVATAR_DIR, clean);
  if (fs.existsSync(localFilePath)) {
    const buffer = fs.readFileSync(localFilePath);
    return {
      buffer,
      mimeType,
      contentLength: buffer.length,
    };
  }

  const notFound = new Error(`Avatar not found: ${clean}`);
  (notFound as unknown as { statusCode: number }).statusCode = 404;
  throw notFound;
}

/**
 * Deletes an avatar blob.
 */
export async function deleteAvatar(filename: string): Promise<boolean> {
  const clean = sanitizeFilename(filename);
  const blobPath = `avatars/${clean}`;

  try {
    await deleteBlob({ blobPath });
  } catch (error) {
    console.warn('[AvatarStorage] Failed to delete blob from Azure:', error);
  }

  const localFilePath = path.join(LOCAL_AVATAR_DIR, clean);
  if (fs.existsSync(localFilePath)) {
    try {
      fs.unlinkSync(localFilePath);
    } catch {
      // Ignored
    }
  }

  return true;
}
