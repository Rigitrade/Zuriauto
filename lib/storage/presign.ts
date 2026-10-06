/**
 * Where the browser should PUT a large file.
 *
 * A scanned letter is routinely larger than the ~4.5 MB Vercel lets through a
 * function, so it does not pass through one: the browser PUTs it straight to
 * the bucket on a URL signed here, valid ten minutes, for exactly one key and
 * content type. The server never sees the bytes until it reads them back to
 * check them.
 *
 * Without R2 — development and tests — the target is a local route that
 * writes to the in-memory store. In production without R2 this refuses, for
 * the reason `getAssetStore` does.
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Endpoint } from "./r2";

export const PRESIGN_SECONDS = 600;

export interface UploadTarget {
  url: string;
  headers: Record<string, string>;
}

export async function uploadTarget(
  key: string,
  contentType: string,
  env: Record<string, string | undefined> = process.env
): Promise<UploadTarget> {
  const headers = { "content-type": contentType };

  if (env.R2_BUCKET) {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 is not fully configured");
    }
    const client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint(R2_ACCOUNT_ID, env.R2_JURISDICTION),
      // Path-style, so the bucket is in the path and the host stays the one
      // the bucket's CORS rule is written for.
      forcePathStyle: true,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
    const url = await getSignedUrl(
      // The presigner and the client resolve separate copies of @smithy's
      // types under pnpm; the object is the same at run time.
      client as unknown as Parameters<typeof getSignedUrl>[0],
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: PRESIGN_SECONDS }
    );
    return { url, headers };
  }

  if (env.NODE_ENV === "production") {
    throw new Error("R2 is not configured. Refusing to accept files with nowhere to put them.");
  }
  // No trailing slash: the key ends in ".pdf", and next.config.ts would 308
  // a file-like path ending in a slash.
  return { url: `/api/admin/fines/uploads/local/${key}`, headers };
}
