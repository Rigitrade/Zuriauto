import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AssetStore } from "./types";

/**
 * Cloudflare R2, over its S3-compatible API.
 *
 * R2 rather than Vercel Blob because the bucket's jurisdiction can be pinned
 * to the EU at creation — and with ID scans and driving licences in it, the
 * region is a legal requirement under the revised Swiss DSG and under GDPR for
 * EU tourists, not a preference.
 *
 * `region: "auto"` is what R2 expects; the SDK insists the field is present.
 */
export function createR2Store(): AssetStore {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } =
    process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 is not fully configured");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );
    },
  };
}
