import fs from 'fs';
import path from 'path';

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
    const rawExt = path.extname(originalFilename).toLowerCase();
    if (['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(rawExt)) {
      ext = rawExt;
    }
  }

  return { valid: true, ext };
}

/**
 * Saves an uploaded receipt buffer safely into the public uploads directory.
 * Kept isolated so external object storage (e.g. S3 / Cloud Storage) can be swapped seamlessly in future.
 */
export async function saveReceiptBuffer(
  buffer: Buffer,
  mimeType: string,
  originalFilename?: string
): Promise<{ url: string; filename: string }> {
  const validation = validateReceiptFile(mimeType, buffer.byteLength, originalFilename);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'receipts');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const filename = `receipt-${uniqueId}${validation.ext}`;
  const filePath = path.join(uploadDir, filename);

  await fs.promises.writeFile(filePath, buffer);

  return {
    url: `/uploads/receipts/${filename}`,
    filename,
  };
}
