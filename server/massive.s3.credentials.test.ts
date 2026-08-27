import { describe, expect, it } from "vitest";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const describeWhenProviderValidationIsEnabled = process.env.RUN_EXTERNAL_PROVIDER_TESTS === "true" ? describe : describe.skip;

describeWhenProviderValidationIsEnabled("Massive flat-file credentials", () => {
  it("can access the configured bucket without mutating data", async () => {
    const endpoint = process.env.MASSIVE_S3_ENDPOINT;
    const bucket = process.env.MASSIVE_S3_BUCKET;
    const accessKeyId = process.env.MASSIVE_S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.MASSIVE_S3_SECRET_ACCESS_KEY;
    expect(endpoint).toBeTruthy();
    expect(bucket).toBeTruthy();
    expect(accessKeyId).toBeTruthy();
    expect(secretAccessKey).toBeTruthy();
    const client = new S3Client({
      region: "us-east-1",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
    const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
    expect(result.$metadata.httpStatusCode).toBeGreaterThanOrEqual(200);
    expect(result.$metadata.httpStatusCode).toBeLessThan(300);
  }, 15_000);
});
