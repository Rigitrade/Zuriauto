import {
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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

/**
 * The S3 endpoint for the bucket.
 *
 * A jurisdiction-restricted bucket does not answer on the account's ordinary
 * host: it has its own, `<account>.<jurisdiction>.r2.cloudflarestorage.com`.
 * Pointing the plain host at an EU bucket fails with NoSuchBucket, which
 * surfaces here as a 503 and a contract that was signed and not recorded — so
 * the default is `eu`, matching the only bucket this project is allowed to
 * use. Set `R2_JURISDICTION=none` for a bucket created without one.
 *
 * Separated from the client so it can be tested without a network or
 * credentials; getting this wrong is silent until a real upload.
 */
export function r2Endpoint(accountId: string, jurisdiction?: string): string {
  const value = (jurisdiction ?? "eu").trim().toLowerCase();
  const host =
    value === "none" || value === ""
      ? `${accountId}.r2.cloudflarestorage.com`
      : `${accountId}.${value}.r2.cloudflarestorage.com`;
  return `https://${host}`;
}

/**
 * The `CopySource` value CopyObject wants: `bucket/key`, URI-encoded.
 *
 * Encoded per segment, not as a whole: the slashes are meaningful separators,
 * so `encodeURIComponent` over the entire string would address one object whose
 * name happens to contain slashes. Any other reserved character inside a
 * segment must still be encoded or the source is misread.
 *
 * Separated from the client so it can be tested without a network — the same
 * reason r2Endpoint is separate, and it fails the same silent way.
 */
export function copySource(bucket: string, key: string): string {
  return `${bucket}/${key}`.split("/").map(encodeURIComponent).join("/");
}

export function createR2Store(): AssetStore {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_JURISDICTION,
  } = process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("R2 is not fully configured");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: r2Endpoint(R2_ACCOUNT_ID, R2_JURISDICTION),
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

    async get(key) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
        );
        if (!result.Body) return null;
        // transformToByteArray is the SDK v3 helper that drains the stream
        // without pulling in Node's stream/consumers, which would not run on
        // every runtime this could deploy to.
        const body = await result.Body.transformToByteArray();
        return {
          body,
          contentType: result.ContentType ?? "application/octet-stream",
        };
      } catch (error) {
        // A missing key is an answer, not a failure — see the note on `get`
        // in ./types.ts. Anything else is a real fault and is rethrown.
        const name = (error as { name?: string })?.name;
        if (name === "NoSuchKey" || name === "NotFound") return null;
        throw error;
      }
    },

    async copy(fromKey, toKey, contentType) {
      await client.send(
        new CopyObjectCommand({
          Bucket: R2_BUCKET,
          Key: toKey,
          CopySource: copySource(R2_BUCKET, fromKey),
          // REPLACE because ContentType is being set; under the default COPY
          // directive it would be silently ignored and the source's metadata
          // kept instead.
          ContentType: contentType,
          MetadataDirective: "REPLACE",
        })
      );
    },
  };
}
