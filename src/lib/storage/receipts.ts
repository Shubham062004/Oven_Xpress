import fs from 'fs';
import path from 'path';
import { sanitizeFilename } from '@/lib/security/input-sanitizer';
import {
  uploadBlob,
  downloadBlob,
  deleteBlob,
  blobExists,
} from './azure-blob';

export const ALLOWED_RECEIPT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
] as const;

export const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  ext?: string;
}

export function validateReceiptFile(
  mimeType: string,
  sizeBytes: number,
  originalFilename?: string
): FileValidationResult {
  if (!ALLOWED_RECEIPT_MIME_TYPES.includes(mimeType as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: 'Invalid file format. Allowed formats: PDF, JPG, JPEG, PNG, WEBP',
    };
  }

  if (sizeBytes > MAX_RECEIPT_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds 5MB limit (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB)`,
    };
  }

  // Derive safe extension
  let ext = '.png';
  if (mimeType === 'application/pdf') ext = '.pdf';
  else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') ext = '.jpg';
  else if (mimeType === 'image/png') ext = '.png';
  else if (mimeType === 'image/webp') ext = '.webp';
  else if (originalFilename) {
    const cleanFilename = sanitizeFilename(originalFilename);
    const rawExt = path.extname(cleanFilename).toLowerCase();
    if (['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(rawExt)) {
      ext = rawExt;
    }
  }

  return { valid: true, ext };
}

/**
 * Validates buffer binary magic bytes against declared MIME type.
 * Prevents polyglot, disguised executable, or HTML/SVG injection attacks.
 */
export function verifyBufferMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.byteLength < 4) return false;

  // PDF signature: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (mimeType === 'application/pdf') {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // JPEG signature: 0xFF, 0xD8, 0xFF
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG signature: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  if (mimeType === 'image/png') {
    return (
      buffer.byteLength >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // WEBP signature: "RIFF" .... "WEBP"
  if (mimeType === 'image/webp') {
    if (buffer.byteLength < 12) return false;
    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    return riff === 'RIFF' && webp === 'WEBP';
  }

  return false;
}

/**
 * Saves an uploaded receipt buffer securely to Azure Blob Storage inside
 * the private "restaurant-files" container under the "receipts/" prefix.
 *
 * Returns the secure, authenticated API stream URL and filename.
 */
export async function saveReceiptBuffer(
  buffer: Buffer,
  mimeType: string,
  originalFilename?: string
): Promise<{ url: string; filename: string; blobPath: string }> {
  const validation = validateReceiptFile(mimeType, buffer.byteLength, originalFilename);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  if (!verifyBufferMagicBytes(buffer, mimeType)) {
    throw new Error('File content signature does not match the specified file type.');
  }

  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const filename = `receipt-${uniqueId}${validation.ext}`;
  const blobPath = `receipts/${filename}`;

  // Upload to Azure Blob Storage (Private container)
  await uploadBlob({
    blobPath,
    buffer,
    mimeType,
    metadata: {
      originalName: originalFilename ? sanitizeFilename(originalFilename) : 'unknown',
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    url: `/api/uploads/receipt/${filename}`,
    filename,
    blobPath,
  };
}

/**
 * Downloads a receipt buffer for authenticated server-mediated streaming.
 * Checks Azure Blob Storage first, falling back to local disk for any legacy files.
 */
export async function getReceiptBuffer(
  filename: string
): Promise<{ buffer: Buffer; mimeType: string; contentLength: number }> {
  const cleanFilename = sanitizeFilename(filename);
  const blobPath = `receipts/${cleanFilename}`;

  // 1. Try downloading from Azure Blob Storage
  try {
    const isPresentInAzure = await blobExists({ blobPath });
    if (isPresentInAzure) {
      const downloaded = await downloadBlob({ blobPath });
      return {
        buffer: downloaded.buffer,
        mimeType: downloaded.mimeType,
        contentLength: downloaded.contentLength,
      };
    }
  } catch (error) {
    // If not a 404, propagate error
    if (error instanceof Error && (error as unknown as { statusCode: number }).statusCode !== 404) {
      throw error;
    }
  }

  // 2. Legacy fallback to local disk (if files existed prior to Azure migration)
  const localFilePath = path.join(process.cwd(), 'public', 'uploads', 'receipts', cleanFilename);
  if (fs.existsSync(localFilePath)) {
    const buffer = await fs.promises.readFile(localFilePath);
    let mimeType = 'application/octet-stream';
    const ext = path.extname(cleanFilename).toLowerCase();
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';

    return {
      buffer,
      mimeType,
      contentLength: buffer.byteLength,
    };
  }

  const notFound = new Error(`Receipt file "${cleanFilename}" not found.`);
  (notFound as unknown as { statusCode: number }).statusCode = 404;
  throw notFound;
}

/**
 * Deletes a receipt from Azure Blob Storage and any local legacy copies.
 */
export async function deleteReceiptBuffer(filename: string): Promise<boolean> {
  const cleanFilename = sanitizeFilename(filename);
  const blobPath = `receipts/${cleanFilename}`;

  // 1. Delete from Azure Blob Storage
  const azureDeleted = await deleteBlob({ blobPath });

  // 2. Delete local legacy copy if exists
  const localFilePath = path.join(process.cwd(), 'public', 'uploads', 'receipts', cleanFilename);
  if (fs.existsSync(localFilePath)) {
    try {
      await fs.promises.unlink(localFilePath);
    } catch {
      // Ignore local file unlink error
    }
  }

  return azureDeleted;
}
