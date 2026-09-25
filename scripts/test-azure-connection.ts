/**
 * Test Azure Blob Storage connectivity, container existence, and basic operations.
 */
import fs from 'node:fs';
import { BlobServiceClient } from '@azure/storage-blob';

// Ensure .env variables are loaded in standalone script runs
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

async function main() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'restaurant-files';

  console.log('Testing Azure Blob Storage Connection...');
  console.log(`Account Name: ovenxpressdev2026`);
  console.log(`Container Name: ${containerName}`);

  if (!connectionString) {
    console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING is not set in environment.');
    process.exit(1);
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Check if container exists; if not, create it
    const exists = await containerClient.exists();
    console.log(`Container "${containerName}" exists: ${exists}`);

    if (!exists) {
      console.log(`Creating container "${containerName}" with private access...`);
      await containerClient.create({ access: undefined }); // private access
      console.log(`Container created successfully.`);
    }

    // Test uploading a test blob
    const testBlobName = `test-health-check-${Date.now()}.txt`;
    const blockBlobClient = containerClient.getBlockBlobClient(testBlobName);
    const content = Buffer.from('Azure Blob Storage connectivity test: OK');

    console.log(`Uploading test blob: ${testBlobName}...`);
    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: 'text/plain' },
      metadata: { test: 'true' },
    });
    console.log(`Test blob uploaded successfully.`);

    // Test downloading the test blob
    const downloadResponse = await blockBlobClient.downloadToBuffer();
    console.log(`Downloaded content: "${downloadResponse.toString('utf-8')}"`);

    // Clean up test blob
    console.log(`Deleting test blob...`);
    await blockBlobClient.delete();
    console.log(`Test blob deleted successfully.`);

    console.log('\n[SUCCESS] Azure Blob Storage connection and operations verified!');
  } catch (error) {
    console.error('[FAIL] Azure Blob Storage operation failed:', error);
    process.exit(1);
  }
}

main();
