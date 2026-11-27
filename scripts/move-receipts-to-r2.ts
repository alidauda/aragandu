/**
 * Moves receipt files that are still in the database into R2, one by one.
 * Each file is uploaded, checked (R2 must hold exactly the same bytes), and
 * only then cleared from the database. Safe to stop and run again: it
 * carries on with whatever hasn't moved.
 *
 *   npx tsx scripts/move-receipts-to-r2.ts            # move them
 *   npx tsx scripts/move-receipts-to-r2.ts --dry-run  # count only
 *
 * Needs DATABASE_URL and the R2_* settings (see src/lib/r2.ts). Afterwards,
 * run VACUUM FULL payment_proofs so Postgres gives the space back.
 */

import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { AwsClient } from "aws4fetch";

import { PrismaClient } from "../src/generated/prisma/client";

const dryRun = process.argv.includes("--dry-run");
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("Set the R2_* settings first.");
const prefix = process.env.R2_MOVE_PREFIX ?? "proofs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
const url = (key: string) => `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

const left = () => prisma.paymentProof.count({ where: { storageKey: null, data: { not: null } } });

async function main() {
  const total = await left();
  console.log(`${total} receipts still in the database`);
  if (dryRun || total === 0) return;
  let moved = 0;
  let bytes = 0;
  for (;;) {
    const batch = await prisma.paymentProof.findMany({
      where: { storageKey: null, data: { not: null } },
      select: { id: true, mimeType: true, data: true, createdAt: true },
      orderBy: { id: "asc" },
      take: 5,
    });
    if (batch.length === 0) break;
    for (const p of batch) {
      const file = new Uint8Array(p.data!);
      const md5 = createHash("md5").update(file).digest("hex");
      const key = `${prefix}/${p.createdAt.toISOString().slice(0, 7)}/${p.id}-${randomUUID()}.${EXT[p.mimeType] ?? "bin"}`;
      const put = await r2.fetch(url(key), { method: "PUT", body: file, headers: { "Content-Type": p.mimeType } });
      if (!put.ok) throw new Error(`Receipt ${p.id}: upload failed (${put.status}) — nothing changed for it.`);
      // R2's ETag for a single upload is the file's MD5: the same bytes arrived.
      const head = await r2.fetch(url(key), { method: "HEAD" });
      const etag = (head.headers.get("etag") ?? "").replace(/"/g, "");
      if (!head.ok || etag !== md5 || Number(head.headers.get("content-length")) !== file.byteLength) {
        throw new Error(`Receipt ${p.id}: R2 doesn't hold the same file (etag ${etag}, expected ${md5}) — left in the database.`);
      }
      // Only a receipt not moved meanwhile is changed.
      const done = await prisma.paymentProof.updateMany({ where: { id: p.id, storageKey: null }, data: { storageKey: key, data: null } });
      if (done.count === 0) {
        await r2.fetch(url(key), { method: "DELETE" });
        continue;
      }
      moved++;
      bytes += file.byteLength;
    }
    console.log(`moved ${moved} of ${total} (${(bytes / 1048576).toFixed(1)} MB)`);
  }
  console.log(`done: ${moved} receipts moved, ${(bytes / 1048576).toFixed(1)} MB; ${await left()} still in the database`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
