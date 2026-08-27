import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

function client() {
  const endpoint = process.env.MASSIVE_S3_ENDPOINT;
  const bucket = process.env.MASSIVE_S3_BUCKET;
  const accessKeyId = process.env.MASSIVE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.MASSIVE_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Massive flat-file storage is not configured");
  return { bucket, s3: new S3Client({ region: "us-east-1", endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } }) };
}

export async function listMassiveFlatFiles(prefix = "", maxKeys = 100) {
  const { bucket, s3 } = client();
  const result = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix.slice(0, 200), MaxKeys: Math.min(1000, Math.max(1, maxKeys)) }));
  return (result.Contents ?? []).map(item => ({ key: item.Key ?? "", size: item.Size ?? 0, lastModified: item.LastModified?.getTime() ?? null })).filter(item => item.key);
}

export async function checkMassiveFlatFileHealth() {
  const started = Date.now();
  try {
    const files = await listMassiveFlatFiles("", 1);
    return { status: "healthy" as const, latencyMs: Date.now() - started, sampleAvailable: files.length > 0 };
  } catch (error) {
    return { status: "unavailable" as const, latencyMs: Date.now() - started, sampleAvailable: false, error: error instanceof Error ? error.message : "Flat-file access failed" };
  }
}

export async function readMassiveFlatFile(key: string, maxBytes = 10_000_000) {
  const { bucket, s3 } = client();
  const safeKey = key.trim().replace(/^\/+/, "");
  if (!safeKey || safeKey.length > 500 || safeKey.includes("..")) throw new Error("Invalid flat-file key");
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: safeKey }));
  const body = response.Body;
  if (!body) throw new Error("Massive flat file has no body");
  const bytes = await body.transformToByteArray();
  if (bytes.byteLength > maxBytes) throw new Error("Massive flat file exceeds the read limit");
  return { key: safeKey, contentType: response.ContentType ?? "application/octet-stream", bytes };
}
