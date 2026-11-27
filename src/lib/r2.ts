import "server-only";

import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 (S3-compatible object storage), where uploaded files live.
 * Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET;
 * without them (local development) files stay in the database.
 */

const env = () => {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: keyId, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env;
  return account && keyId && secret && bucket ? { account, keyId, secret, bucket } : null;
};

export const r2Enabled = () => env() !== null;

let client: { aws: AwsClient; base: string } | null = null;
function r2() {
  const e = env();
  if (!e) throw new Error("R2 is not configured.");
  client ??= {
    aws: new AwsClient({ accessKeyId: e.keyId, secretAccessKey: e.secret, service: "s3", region: "auto" }),
    base: `https://${e.account}.r2.cloudflarestorage.com/${e.bucket}`,
  };
  return client;
}

const url = (key: string) => `${r2().base}/${key.split("/").map(encodeURIComponent).join("/")}`;

export async function putObject(key: string, bytes: Uint8Array, type: string) {
  const res = await r2().aws.fetch(url(key), { method: "PUT", body: new Uint8Array(bytes), headers: { "Content-Type": type } });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
}

/** The object's bytes, or null if it isn't there. */
export async function getObject(key: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const res = await r2().aws.fetch(url(key));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 read failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Best effort: a file left behind costs storage, not correctness. */
export async function deleteObjects(keys: string[]) {
  for (const key of keys) {
    await r2()
      .aws.fetch(url(key), { method: "DELETE" })
      .catch((e) => console.error("R2 delete failed", key, e));
  }
}
