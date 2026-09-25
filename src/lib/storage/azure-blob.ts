/**
 * Azure Blob Storage Service Layer
 *
 * Provides a production-grade, centralized server-side client for Azure Blob Storage.
 *
 * Target Architecture:
 * Browser -> Next.js Server (API/Server Action) -> Azure Storage Service -> Azure Blob Storage
 *
 * Security Invariants:
 * 1. Server-Only Execution: Connection strings and storage account keys are NEVER exposed to the client.
 * 2. Private Container: restaurant-files is private with no anonymous public access.
 * 3. Reusable Singleton: BlobServiceClient and ContainerClient instances are cached across requests.
 * 4. Sanitized Error Handling: Storage errors and credentials are never leaked in client-facing exceptions.
 */

import {
  BlobServiceClient,
  ContainerClient,
  RestError,
} from '@azure/storage-blob';
import { logApiError } from '@/lib/security/security-logger';

export const DEFAULT_CONTAINER_NAME =
  process.env.AZURE_STORAGE_CONTAINER_NAME || 'restaurant-files';

let cachedBlobServiceClient: BlobServiceClient | null = null;
const cachedContainerClients = new Map<string, ContainerClient>();

/**
 * Sanitizes and normalizes a storage path / blob name.
 * Prevents directory traversal, leading slashes, and illegal path characters.
 */
export function normalizeBlobPath(blobPath: string): string {
  if (!blobPath || typeof blobPath !== 'string') {
    throw new Error('Invalid blob path: path must be a non-empty string.');
  }

  // Remove leading slashes and Windows backslashes
  let clean = blobPath.replace(/\\/g, '/').replace(/^\/+/, '');

  // Strip path traversal tokens
  clean = clean
    .split('/')
    .filter((segment) => segment !== '..' && segment !== '.' && segment.length > 0)
    .join('/');

  if (!clean || clean.length === 0) {
    throw new Error('Invalid blob path after sanitization.');
  }

  return clean;
}

/**
 * Retrieves or initializes the singleton BlobServiceClient on the server.
 * Validates the connection string without leaking sensitive tokens in errors.
 */
export function getBlobServiceClient(): BlobServiceClient {
  if (cachedBlobServiceClient) {
    return cachedBlobServiceClient;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      'Azure Blob Storage is not configured. Missing AZURE_STORAGE_CONNECTION_STRING in server environment.'
    );
  }

  try {
    cachedBlobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    return cachedBlobServiceClient;
  } catch (initError) {
    logApiError({
      path: 'lib/storage/azure-blob',
      method: 'INIT',
      statusCode: 500,
      error: initError instanceof Error ? initError.message : 'Failed to initialize BlobServiceClient',
    });
    throw new Error('Failed to initialize Azure Blob Storage client. Check server connection string configuration.');
  }
}

/**
 * Retrieves or initializes a ContainerClient for the designated container.
 */
export function getContainerClient(containerName = DEFAULT_CONTAINER_NAME): ContainerClient {
  const normalizedContainer = containerName.trim();
  const cached = cachedContainerClients.get(normalizedContainer);
  if (cached) {
    return cached;
  }

  const serviceClient = getBlobServiceClient();
  const client = serviceClient.getContainerClient(normalizedContainer);
  cachedContainerClients.set(normalizedContainer, client);
  return client;
}

/**
 * Ensures the target container exists. If not, creates it with private access.
 */
export async function ensureContainerExists(
  containerName = DEFAULT_CONTAINER_NAME
): Promise<ContainerClient> {
  const containerClient = getContainerClient(containerName);
  try {
    const exists = await containerClient.exists();
    if (!exists) {
      await containerClient.create({ access: undefined }); // Strictly private: no anonymous public access
    }
    return containerClient;
  } catch (error) {
    throw sanitizeStorageError(error, 'ensureContainerExists', containerName);
  }
}

export interface UploadBlobOptions {
  blobPath: string;
  buffer: Buffer;
  mimeType: string;
  containerName?: string;
  metadata?: Record<string, string>;
}

export interface UploadBlobResult {
  blobPath: string;
  containerName: string;
  contentLength: number;
  etag?: string;
}

/**
 * Uploads a file buffer directly to Azure Blob Storage inside a private container.
 */
export async function uploadBlob(options: UploadBlobOptions): Promise<UploadBlobResult> {
  const { blobPath, buffer, mimeType, metadata } = options;
  const containerName = options.containerName || DEFAULT_CONTAINER_NAME;
  const safeBlobPath = normalizeBlobPath(blobPath);

  try {
    const containerClient = getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(safeBlobPath);

    const uploadResponse = await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
        blobCacheControl: 'private, no-cache, no-store, must-revalidate',
      },
      metadata: metadata || {},
    });

    return {
      blobPath: safeBlobPath,
      containerName,
      contentLength: buffer.length,
      etag: uploadResponse.etag,
    };
  } catch (error) {
    throw sanitizeStorageError(error, 'uploadBlob', safeBlobPath);
  }
}

export interface DownloadBlobOptions {
  blobPath: string;
  containerName?: string;
}

export interface DownloadBlobResult {
  buffer: Buffer;
  mimeType: string;
  contentLength: number;
  etag?: string;
  metadata?: Record<string, string>;
  lastModified?: Date;
}

/**
 * Downloads a private blob buffer from Azure Blob Storage for authenticated server streaming.
 */
export async function downloadBlob(options: DownloadBlobOptions): Promise<DownloadBlobResult> {
  const { blobPath } = options;
  const containerName = options.containerName || DEFAULT_CONTAINER_NAME;
  const safeBlobPath = normalizeBlobPath(blobPath);

  try {
    const containerClient = getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(safeBlobPath);

    // Verify blob exists
    const exists = await blockBlobClient.exists();
    if (!exists) {
      const err = new Error(`File "${safeBlobPath}" not found in storage.`);
      (err as unknown as { statusCode: number }).statusCode = 404;
      throw err;
    }

    const [buffer, properties] = await Promise.all([
      blockBlobClient.downloadToBuffer(),
      blockBlobClient.getProperties(),
    ]);

    return {
      buffer,
      mimeType: properties.contentType || 'application/octet-stream',
      contentLength: properties.contentLength ?? buffer.length,
      etag: properties.etag,
      metadata: properties.metadata,
      lastModified: properties.lastModified,
    };
  } catch (error) {
    throw sanitizeStorageError(error, 'downloadBlob', safeBlobPath);
  }
}

export interface DeleteBlobOptions {
  blobPath: string;
  containerName?: string;
}

/**
 * Deletes a blob from Azure Blob Storage.
 * Safe idempotent operation: returns true whether deleted or already non-existent.
 */
export async function deleteBlob(options: DeleteBlobOptions): Promise<boolean> {
  const { blobPath } = options;
  const containerName = options.containerName || DEFAULT_CONTAINER_NAME;
  const safeBlobPath = normalizeBlobPath(blobPath);

  try {
    const containerClient = getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(safeBlobPath);

    const deleteResponse = await blockBlobClient.deleteIfExists();
    return deleteResponse.succeeded;
  } catch (error) {
    throw sanitizeStorageError(error, 'deleteBlob', safeBlobPath);
  }
}

export interface BlobExistsOptions {
  blobPath: string;
  containerName?: string;
}

/**
 * Checks whether a blob exists in the container.
 */
export async function blobExists(options: BlobExistsOptions): Promise<boolean> {
  const { blobPath } = options;
  const containerName = options.containerName || DEFAULT_CONTAINER_NAME;
  const safeBlobPath = normalizeBlobPath(blobPath);

  try {
    const containerClient = getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(safeBlobPath);
    return await blockBlobClient.exists();
  } catch (error) {
    throw sanitizeStorageError(error, 'blobExists', safeBlobPath);
  }
}

export interface BlobPropertiesResult {
  contentLength: number;
  contentType: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

/**
 * Retrieves metadata and HTTP headers of a stored blob.
 */
export async function getBlobProperties(
  options: BlobExistsOptions
): Promise<BlobPropertiesResult | null> {
  const { blobPath } = options;
  const containerName = options.containerName || DEFAULT_CONTAINER_NAME;
  const safeBlobPath = normalizeBlobPath(blobPath);

  try {
    const containerClient = getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(safeBlobPath);

    const exists = await blockBlobClient.exists();
    if (!exists) return null;

    const props = await blockBlobClient.getProperties();
    return {
      contentLength: props.contentLength ?? 0,
      contentType: props.contentType || 'application/octet-stream',
      etag: props.etag,
      lastModified: props.lastModified,
      metadata: props.metadata,
    };
  } catch (error) {
    throw sanitizeStorageError(error, 'getBlobProperties', safeBlobPath);
  }
}

/**
 * Sanitizes errors from the Azure Storage SDK to ensure credentials,
 * connection strings, or sensitive cloud architecture are never returned to clients.
 */
function sanitizeStorageError(error: unknown, operation: string, target: string): Error {
  if (error instanceof Error && (error as unknown as { statusCode: number }).statusCode === 404) {
    return error;
  }

  logApiError({
    path: `lib/storage/azure-blob#${operation}`,
    method: 'STORAGE_OP',
    statusCode: (error as RestError)?.statusCode || 500,
    error,
    details: { target },
  });

  if (error instanceof RestError) {
    if (error.statusCode === 404) {
      const notFoundErr = new Error(`Resource "${target}" not found.`);
      (notFoundErr as unknown as { statusCode: number }).statusCode = 404;
      return notFoundErr;
    }
    if (error.statusCode === 403) {
      return new Error('Storage access forbidden. Verify storage configuration.');
    }
  }

  return new Error(`Storage operation (${operation}) failed. Please try again later.`);
}
