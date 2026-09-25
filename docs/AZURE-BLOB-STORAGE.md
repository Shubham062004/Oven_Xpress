# Azure Blob Storage Architecture & Integration Guide

## 1. Overview & Provisioning Details

Oven Xpress uses **Azure Blob Storage** for secure, scalable server-side storage of business files (such as expense receipts, invoices, and purchase order documentation).

### Azure Resource Specifications

| Parameter | Value |
| :--- | :--- |
| **Storage Account Name** | `ovenxpressdev2026` |
| **Resource Group** | `rg-ovenxpress-dev` |
| **Container Name** | `restaurant-files` |
| **Container Access Level** | **Private** (No anonymous or public access) |
| **Storage Account Kind** | `StorageV2` (General-purpose v2) |
| **Performance Tier** | Standard |
| **Replication** | Locally-Redundant Storage (LRS) |
| **Provider SDK** | `@azure/storage-blob` (v12.x) |

---

## 2. Target Architecture

All communication with Azure Blob Storage occurs **strictly on the server**. The browser client never interacts directly with Azure, and no Azure credentials, account keys, or connection strings are ever leaked to the frontend.

```
Browser Client
   │
   │ 1. Multipart Form Upload / Authenticated Download Request
   ▼
Next.js Server API Routes / Server Actions
   ├── Session Authentication Guard (HTTP-only secure cookie)
   ├── Role-Based Access Control (RBAC) Verification
   └── Multi-Tenant Branch Isolation Guard
   │
   │ 2. Server-side Stream / Blob Client
   ▼
Centralized Storage Service (`src/lib/storage/azure-blob.ts`)
   ├── Path Sanitization & Traversal Neutralization
   ├── Magic Byte & MIME Type Whitelist Validation
   └── Singleton BlobServiceClient / ContainerClient
   │
   │ 3. HTTPS Encrypted Protocol
   ▼
Azure Blob Storage (`ovenxpressdev2026 / restaurant-files`)
   └── Private Container (`receipts/{filename}`)
```

---

## 3. Environment Configuration

### Required Environment Variables

Configure these variables in your server environment (`.env` for local development, or platform environment settings in production). **Never prepend these variables with `NEXT_PUBLIC_`.**

```env
# File Storage Configuration (Azure Blob Storage)
STORAGE_PROVIDER="azure"
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=ovenxpressdev2026;AccountKey=...;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="restaurant-files"
```

### Template (`.env.example`)

Placeholders only are committed to `.env.example`:

```env
STORAGE_PROVIDER="azure"
AZURE_STORAGE_CONNECTION_STRING=""
AZURE_STORAGE_CONTAINER_NAME="restaurant-files"
```

> [!CAUTION]
> Never commit real Azure connection strings or account keys to Git or repository history.

---

## 4. Centralized Storage Layer

The storage abstraction is centralized in [`src/lib/storage/azure-blob.ts`](file:///c:/Users/shubh/OneDrive/Desktop/Work/Oven_Xpress/src/lib/storage/azure-blob.ts), exposing reusable, server-safe operations:

| Function | Description |
| :--- | :--- |
| `getBlobServiceClient()` | Returns singleton `BlobServiceClient`, initialized from connection string. |
| `getContainerClient(containerName?)` | Returns singleton `ContainerClient` for `restaurant-files`. |
| `uploadBlob(options)` | Uploads a buffer directly to Azure with specified MIME type and metadata. |
| `downloadBlob(options)` | Downloads a blob buffer from Azure for server-mediated streaming. |
| `deleteBlob(options)` | Deletes a blob safely and idempotently via `deleteIfExists()`. |
| `blobExists(options)` | Checks whether a blob exists in the container. |
| `getBlobProperties(options)` | Retrieves blob metadata, size, contentType, and last modified date. |
| `normalizeBlobPath(path)` | Strips directory traversal sequences (`..`), null bytes, and leading slashes. |

---

## 5. File Validation & Security Rules

To prevent arbitrary file execution, stored cross-site scripting (XSS), and denial-of-service via massive payloads:

1. **Size Limit**: Enforced maximum of **5 MB** (`5 * 1024 * 1024` bytes).
2. **MIME Whitelist**: Only the following MIME types are accepted:
   - `application/pdf`
   - `image/jpeg`
   - `image/png`
   - `image/webp`
3. **Magic Byte Verification**: Buffers are inspected for binary file signatures before upload:
   - PDF: `%PDF-` (`0x25 0x50 0x44 0x46`)
   - JPEG: `0xFF 0xD8 0xFF`
   - PNG: `0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`
   - Disguised scripts, executables, or HTML/SVG files are immediately rejected.
4. **Deterministic Random Filenames**: Original filenames are discarded. All stored blobs use a safe, cryptographically unguessable name:
   `receipt-{timestamp}-{randomHash}.{ext}` (stored under `receipts/{filename}`).

---

## 6. Upload, Access & Deletion Workflows

### Upload Workflow
1. User submits file to `POST /api/uploads/receipt`.
2. Handler authenticates user session and validates permissions (`EXPENSE_CREATE`, `EXPENSE_UPDATE`, `PURCHASE_CREATE`, or `PURCHASE_UPDATE`).
3. Payload is validated (size, MIME, magic bytes).
4. File is uploaded to Azure container `restaurant-files` under `receipts/${filename}`.
5. The endpoint returns the application route `/api/uploads/receipt/${filename}` to be stored in the database.

### Private Download & Access Workflow
Because the Azure container is **private** and has no anonymous access:
1. User requests `/api/uploads/receipt/[filename]`.
2. Handler checks session authentication.
3. Checks user permissions (`EXPENSE_READ` or `PURCHASE_READ`).
4. **Multi-Tenant Branch Isolation**: If the receipt is linked to an expense or purchase, the user's `branchId` is verified. Branch managers and staff cannot access receipts from other branches.
5. Handler streams blob buffer from Azure to client with security headers:
   - `Content-Security-Policy: default-src 'none'; sandbox`
   - `X-Content-Type-Options: nosniff`
   - `Cache-Control: private, max-age=3600`

### Deletion Workflow
1. Client sends `DELETE /api/uploads/receipt/[filename]`.
2. Handler verifies user session and permission (`EXPENSE_UPDATE`, `EXPENSE_CANCEL`, or `PURCHASE_UPDATE`).
3. Verifies branch ownership.
4. Blob is deleted via `deleteBlob` (`deleteIfExists`), returning a clean 200 response.

---

## 7. AWS / S3 Migration Notes

- **AWS Dependencies Removed**: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` were verified and completely removed.
- **Obsolete S3 Variables Removed**: `STORAGE_S3_ENDPOINT`, `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`, and `STORAGE_S3_SECRET_ACCESS_KEY` have been removed from active configuration and replaced with `AZURE_STORAGE_*`.
- **Database Schema**: Existing schema stores relative URLs (e.g. `/api/uploads/receipt/{filename}`) in `Expense.receiptUrl`. No breaking database schema alterations were required.
- **Existing Files**: The database currently has 0 expenses with receipts and `public/uploads` is empty. No historical S3 migration was necessary.

---

## 8. Verification & Testing

An automated verification test suite is provided at [`scripts/verify-azure-storage.ts`](file:///c:/Users/shubh/OneDrive/Desktop/Work/Oven_Xpress/scripts/verify-azure-storage.ts).

Run verification:
```bash
npx tsx scripts/verify-azure-storage.ts
```

### Verified Scenarios (15/15 Passed):
- [x] Environment configuration validation
- [x] Azure Blob Service & private container connectivity
- [x] Path traversal neutralization (`normalizeBlobPath`)
- [x] Valid PNG, JPG, and PDF uploads
- [x] Disguised executable / spoofed file rejection
- [x] Unsupported extensions rejection
- [x] Oversized file (> 5MB) rejection
- [x] Blob upload to Azure container
- [x] Blob existence check
- [x] Metadata and HTTP properties retrieval
- [x] Blob download and byte-for-byte binary integrity
- [x] Blob deletion from Azure
- [x] Verification that deleted blob no longer exists
- [x] Idempotent deletion handling without server crashes
- [x] Integrated receipt helper flow (`saveReceiptBuffer` -> `getReceiptBuffer` -> `deleteReceiptBuffer`)

---

## 9. Deployment Configuration Guide

### Deploying to Azure App Service / Azure Container Apps / VM
Set the following application settings in your deployment portal:

```bash
az webapp config appsettings set \
  --resource-group rg-ovenxpress-dev \
  --name oven-xpress-app \
  --settings \
    STORAGE_PROVIDER="azure" \
    AZURE_STORAGE_CONTAINER_NAME="restaurant-files" \
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=ovenxpressdev2026;AccountKey=...;EndpointSuffix=core.windows.net"
```

### Future Enhancement: Azure Managed Identity
When hosting on Azure App Service or Azure Kubernetes Service (AKS), the connection string can optionally be replaced by **System-Assigned Managed Identity** (`DefaultAzureCredential` from `@azure/identity`) paired with the **Storage Blob Data Contributor** RBAC role. This eliminates the need for connection strings or static secrets entirely.
