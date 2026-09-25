/**
 * Comprehensive Verification Test Suite for Azure Blob Storage Migration
 * 
 * Verifies:
 * 1. Environment configuration
 * 2. Connectivity to Azure Storage Account (ovenxpressdev2026 / restaurant-files)
 * 3. File validation (extensions, MIME types, magic bytes, file size limits)
 * 4. Path traversal prevention (normalizeBlobPath)
 * 5. Blob lifecycle: upload, exists, metadata, download, delete, idempotency
 * 6. Receipt storage helpers (saveReceiptBuffer, getReceiptBuffer, deleteReceiptBuffer)
 * 7. Error handling & resilience
 */

import fs from 'node:fs';
import {
  uploadBlob,
  downloadBlob,
  deleteBlob,
  blobExists,
  getBlobProperties,
  normalizeBlobPath,
  getContainerClient,
} from '../src/lib/storage/azure-blob';
import {
  saveReceiptBuffer,
  getReceiptBuffer,
  deleteReceiptBuffer,
  validateReceiptFile,
  verifyBufferMagicBytes,
} from '../src/lib/storage/receipts';

// Ensure .env is loaded if running via standalone node/tsx
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const status = passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${status} ${name} - ${details}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('  Oven Xpress: Azure Blob Storage Verification Test Suite');
  console.log('================================================================\n');

  // Test 1: Environment Variables
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'restaurant-files';
  const provider = process.env.STORAGE_PROVIDER;

  const envPassed = Boolean(connStr && containerName && provider === 'azure');
  record(
    'Environment Configuration',
    envPassed,
    `Provider: ${provider}, Container: ${containerName}, ConnString Present: ${Boolean(connStr)}`
  );
  if (!envPassed) {
    console.error('Cannot proceed without valid environment configuration.');
    process.exit(1);
  }

  // Test 2: Azure Client & Container Existence
  try {
    const containerClient = getContainerClient();
    const exists = await containerClient.exists();
    record('Container Verification', exists, `Container "${containerName}" exists on Azure account`);
  } catch (err) {
    record('Container Verification', false, `Failed to query container: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Test 3: Path Traversal Neutralization
  const dangerousPaths = [
    { input: '../../etc/passwd', expected: 'etc/passwd' },
    { input: '..\\..\\windows\\system32\\cmd.exe', expected: 'windows/system32/cmd.exe' },
    { input: '///receipts///2026///sample.png', expected: 'receipts/2026/sample.png' },
    { input: 'receipts/../sensitive/data.pdf', expected: 'sensitive/data.pdf' },
  ];

  let traversalPassed = true;
  for (const testCase of dangerousPaths) {
    const normalized = normalizeBlobPath(testCase.input);
    if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('\\')) {
      traversalPassed = false;
      break;
    }
  }
  record('Path Traversal Prevention', traversalPassed, 'Normalized malicious paths safely strip traversal sequences');

  // Test 4: File Validation Suite
  // PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
  // JPEG Magic Bytes: FF D8 FF
  const validJpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  // PDF Magic Bytes: %PDF-
  const validPdfHeader = Buffer.from('%PDF-1.5 test document content');
  // Fake executable disguised as png
  const fakePngPayload = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');
  // Oversized buffer (5MB + 1KB)
  const oversizedSize = 5 * 1024 * 1024 + 1024;

  const pngValidation = validateReceiptFile('image/png', validPngHeader.length, 'receipt.png');
  const pngMagic = verifyBufferMagicBytes(validPngHeader, 'image/png');

  const jpgValidation = validateReceiptFile('image/jpeg', validJpgHeader.length, 'bill.jpg');
  const jpgMagic = verifyBufferMagicBytes(validJpgHeader, 'image/jpeg');

  const pdfValidation = validateReceiptFile('application/pdf', validPdfHeader.length, 'invoice.pdf');
  const pdfMagic = verifyBufferMagicBytes(validPdfHeader, 'application/pdf');

  const spoofMagic = verifyBufferMagicBytes(fakePngPayload, 'image/png');
  const invalidMimeValidation = validateReceiptFile('application/x-msdownload', 1024, 'virus.exe');
  const oversizedValidation = validateReceiptFile('image/png', oversizedSize, 'huge.png');

  const validationSuitePassed =
    pngValidation.valid &&
    pngMagic &&
    jpgValidation.valid &&
    jpgMagic &&
    pdfValidation.valid &&
    pdfMagic &&
    !spoofMagic &&
    !invalidMimeValidation.valid &&
    !oversizedValidation.valid;

  record(
    'File Validation Rules',
    validationSuitePassed,
    `PNG: ${pngValidation.valid && pngMagic}, JPG: ${jpgValidation.valid && jpgMagic}, PDF: ${pdfValidation.valid && pdfMagic}, Disguised Executable Rejected: ${!spoofMagic}, Bad Ext/MIME Rejected: ${!invalidMimeValidation.valid}, Oversized (>5MB) Rejected: ${!oversizedValidation.valid}`
  );

  // Test 5: Azure Blob Lifecycle (Upload -> Exists -> Metadata -> Download -> Delete)
  const testBlobKey = `test-verify/verify-run-${Date.now()}.png`;
  const testBuffer = Buffer.concat([validPngHeader, Buffer.from('OvenXpress Azure Storage Test Payload')]);

  try {
    // 5a. Upload
    const uploadRes = await uploadBlob({
      blobPath: testBlobKey,
      buffer: testBuffer,
      mimeType: 'image/png',
      metadata: { environment: 'test', automated: 'true' },
    });
    const uploadedOk = uploadRes.blobPath === testBlobKey && uploadRes.contentLength === testBuffer.length;
    record('Blob Upload', uploadedOk, `Uploaded blob "${testBlobKey}" (${uploadRes.contentLength} bytes)`);

    // 5b. Exists
    const existsAfterUpload = await blobExists({ blobPath: testBlobKey });
    record('Blob Exists Check', existsAfterUpload, `Verified blob exists in container: ${existsAfterUpload}`);

    // 5c. Metadata & Properties
    const props = await getBlobProperties({ blobPath: testBlobKey });
    const propsOk = props !== null && props.contentType === 'image/png' && props.contentLength === testBuffer.length;
    record('Blob Properties & Metadata', propsOk, `ContentType: ${props?.contentType}, ContentLength: ${props?.contentLength}`);

    // 5d. Download & Byte Integrity
    const downloadRes = await downloadBlob({ blobPath: testBlobKey });
    const contentMatches = downloadRes.buffer.equals(testBuffer);
    record('Blob Download & Integrity', contentMatches, `Downloaded ${downloadRes.buffer.length} bytes (Byte-for-byte match: ${contentMatches})`);

    // 5e. Delete
    const deletedOk = await deleteBlob({ blobPath: testBlobKey });
    record('Blob Deletion', deletedOk, `Successfully deleted test blob`);

    // 5f. Confirm Deleted
    const existsAfterDelete = await blobExists({ blobPath: testBlobKey });
    record('Blob Gone After Delete', !existsAfterDelete, `Blob does not exist post-deletion: ${!existsAfterDelete}`);

    // 5g. Idempotent Deletion (Deleting non-existent blob should not throw and return false safely)
    let idempotentOk = false;
    try {
      const secondDeleteRes = await deleteBlob({ blobPath: testBlobKey });
      // deleteIfExists returns false if blob didn't exist, without throwing
      idempotentOk = secondDeleteRes === false;
    } catch {
      idempotentOk = false;
    }
    record('Idempotent Deletion', idempotentOk, `Deleting already-deleted blob handled gracefully without error`);
  } catch (err) {
    record('Blob Lifecycle', false, `Lifecycle failed with error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Test 6: Receipt Integration Helpers (saveReceiptBuffer, getReceiptBuffer, deleteReceiptBuffer)
  try {
    const receiptSampleContent = Buffer.concat([validPngHeader, Buffer.from('Expense Receipt Sample Data 2026')]);
    const receiptResult = await saveReceiptBuffer(receiptSampleContent, 'image/png', 'receipt_sample.png');

    record('Receipt Storage: Save', receiptResult.url.startsWith('/api/uploads/receipt/'), `Generated receipt endpoint URL: ${receiptResult.url}, blobPath: ${receiptResult.blobPath}`);

    // Retrieve via helper
    const retrieved = await getReceiptBuffer(receiptResult.filename);
    const retrievedOk = retrieved !== null && retrieved.buffer.equals(receiptSampleContent);
    record('Receipt Storage: Get', retrievedOk, `Retrieved buffer from Azure: ${retrieved?.buffer.length} bytes, mimeType: ${retrieved?.mimeType}`);

    // Delete via helper
    const deleteReceiptOk = await deleteReceiptBuffer(receiptResult.filename);
    record('Receipt Storage: Delete', deleteReceiptOk, `Deleted receipt from Azure container`);

    // Confirm gone (should throw 404)
    let receiptConfirmedGone = false;
    try {
      await getReceiptBuffer(receiptResult.filename);
    } catch (notFoundErr) {
      if (
        notFoundErr instanceof Error &&
        ((notFoundErr as unknown as { statusCode: number }).statusCode === 404 ||
          notFoundErr.message.includes('not found'))
      ) {
        receiptConfirmedGone = true;
      }
    }
    record('Receipt Storage: Verified Gone', receiptConfirmedGone, `Receipt correctly throws 404 post-deletion: ${receiptConfirmedGone}`);
  } catch (err) {
    record('Receipt Storage Integration', false, `Receipt helper failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Summary
  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`  Summary: ${passed}/${total} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error('\x1b[31m[FAILED] Some verification tests failed.\x1b[0m');
    process.exit(1);
  } else {
    console.log('\x1b[32m[SUCCESS] All Azure Blob Storage verification tests passed successfully!\x1b[0m');
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
