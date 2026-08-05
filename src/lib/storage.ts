// ─────────────────────────────────────────────────────────────
// Azure Blob Storage – document storage abstraction
// Supports Azurite (local dev) and Azure Storage (production via MI)
// ─────────────────────────────────────────────────────────────
import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  SASProtocol,
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import { randomUUID } from "node:crypto";

const connectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const storageAccountName =
  process.env.AZURE_STORAGE_ACCOUNT_NAME || "";
const containerName =
  process.env.AZURE_STORAGE_CONTAINER_DOCUMENTS || "documents";

const isLocalDev = connectionString.includes("UseDevelopmentStorage") ||
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("devstoreaccount");

let _client: BlobServiceClient | null = null;

async function getClient(): Promise<BlobServiceClient> {
  if (!_client) {
    if (connectionString) {
      _client = BlobServiceClient.fromConnectionString(connectionString);
    } else if (storageAccountName) {
      _client = new BlobServiceClient(
        `https://${storageAccountName}.blob.core.windows.net`,
        new DefaultAzureCredential()
      );
    } else {
      throw new Error(
        "No storage config. Set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME"
      );
    }
  }
  return _client;
}

async function ensureContainer() {
  const client = await getClient();
  const container = client.getContainerClient(containerName);
  try {
    await container.createIfNotExists({ access: undefined });
  } catch (e) {
    console.warn("Container create check:", (e as Error).message);
  }
  return container;
}

/**
 * Upload a file buffer to Azure Blob Storage.
 * Returns the blob path (not a direct URL – we use SAS tokens for access).
 */
export async function uploadDocument(
  applicationId: string,
  requirementKey: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const container = await ensureContainer();
  const ext = filename.split(".").pop() || "bin";
  const blobName = `${applicationId}/${requirementKey}/${randomUUID()}.${ext}`;

  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
      blobContentDisposition: `attachment; filename="${filename}"`,
    },
    metadata: {
      applicationId,
      requirementKey,
      originalFilename: filename,
    },
  });

  return { storagePath: blobName, fileSizeBytes: buffer.length };
}

/**
 * Generate a time-limited URL for downloading a document.
 */
export async function getDocumentUrl(
  storagePath: string,
  expiryMinutes = 15
): Promise<string> {
  const container = await ensureContainer();
  const blockBlob = container.getBlockBlobClient(storagePath);

  // For development storage, return the blob URL directly
  if (isLocalDev) {
    return blockBlob.url;
  }

  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

  if (connectionString) {
    return blockBlob.generateSasUrl({
      permissions: BlobSASPermissions.parse("r"),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    });
  }

  const client = await getClient();
  const delegationKey = await client.getUserDelegationKey(startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: storagePath,
      permissions: BlobSASPermissions.parse("r"),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    delegationKey,
    storageAccountName
  ).toString();

  return `${blockBlob.url}?${sas}`;
}

/**
 * Delete a document from storage.
 */
export async function deleteDocument(storagePath: string): Promise<void> {
  const container = await ensureContainer();
  const blockBlob = container.getBlockBlobClient(storagePath);
  await blockBlob.deleteIfExists();
}

/**
 * Validate file type and size before upload.
 */
export function validateFile(
  mimeType: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  const maxSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);
  const allowedTypes = (
    process.env.ALLOWED_MIME_TYPES ||
    "application/pdf,image/jpeg,image/png,image/gif,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ).split(",");

  if (sizeBytes > maxSizeMb * 1024 * 1024) {
    return { valid: false, error: `File size exceeds ${maxSizeMb}MB limit` };
  }

  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type ${mimeType} is not accepted. Allowed: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}
