import "server-only";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { later } from "@/lib/mail";
import { alertAdmins } from "@/lib/notify";
import { invNo, naira } from "@/lib/orders";
import { deleteObjects, getObject, putObject, r2Enabled } from "@/lib/r2";

/**
 * Payment proofs: a buyer's transfer receipt or bank slip, uploaded against
 * an order or invoice when they pay outside the app. The files live in R2
 * (src/lib/r2.ts); receipts from before that keep theirs in the database
 * until moved. Everything that stores or reads one goes through here.
 */

export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
/** Receipts waiting on one order or invoice at a time (a payment split into several transfers). */
export const PROOF_MAX_OPEN = 10;

/** The file's real type from its first bytes — never the name or the browser's word for it. */
export function sniffType(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | null {
  const at = (i: number, bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (at(0, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  return null;
}

/** A file name safe to show and to send back in a header. */
export const cleanName = (name: string) =>
  name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "receipt";

export async function saveProof(p: {
  /** Null for a walk-in buyer's invoice. */
  customerId: number | null;
  orderId: number | null;
  invoiceId: number | null;
  amount: number;
  reference: string;
  note: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  uploadedBy: string;
}) {
  // The file goes to R2 first; the record points at it. (Without R2, in the database.)
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[p.mimeType] ?? "bin";
  const storageKey = r2Enabled() ? `proofs/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}` : null;
  if (storageKey) await putObject(storageKey, p.bytes, p.mimeType);
  return prisma.paymentProof.create({
    data: {
      customerId: p.customerId,
      orderId: p.orderId,
      invoiceId: p.invoiceId,
      amount: p.amount,
      reference: p.reference,
      note: p.note,
      fileName: cleanName(p.fileName),
      mimeType: p.mimeType,
      size: p.bytes.byteLength,
      data: storageKey ? null : Buffer.from(p.bytes),
      storageKey,
      uploadedBy: p.uploadedBy,
    },
    select: { id: true },
  }).catch(async (e) => {
    // No record, so no file.
    if (storageKey) await deleteObjects([storageKey]);
    throw e;
  });
}

/** Who a receipt belongs to, and how to read its file, for serving it. */
export async function proofFile(id: number) {
  const p = await prisma.paymentProof.findUnique({
    where: { id },
    select: { customerId: true, fileName: true, mimeType: true, data: true, storageKey: true, invoice: { select: { product: true } } },
  });
  if (!p) return null;
  const { data, storageKey, ...rest } = p;
  return {
    ...rest,
    /** Null if the file is missing from storage. */
    bytes: async (): Promise<Uint8Array<ArrayBuffer> | null> => (storageKey ? getObject(storageKey) : data ? new Uint8Array(data) : null),
  };
}

/** Removes stored files once their receipts are deleted. */
export async function deleteProofFiles(storageKeys: (string | null)[]) {
  const keys = storageKeys.filter((k): k is string => !!k);
  if (keys.length && r2Enabled()) await deleteObjects(keys);
}

/** Everything about the proofs but the files, for lists. */
export const PROOF_FIELDS = {
  id: true,
  customerId: true,
  orderId: true,
  invoiceId: true,
  amount: true,
  reference: true,
  note: true,
  fileName: true,
  mimeType: true,
  status: true,
  rejectReason: true,
  reviewedBy: true,
  uploadedBy: true,
  createdAt: true,
} as const;

export type ProofResult = { ok: true; id: number } | { ok: false; error: string; status?: number };

/**
 * Reads an upload (multipart: file, kind "order" | "invoice", id, amount,
 * reference, note), checks the file and that the order or invoice is
 * unpaid — and, for a buyer, theirs — then saves it under the uploader's
 * name and logs it. `allow` decides, once it's known what was sold, whether
 * this uploader may. A walk-in buyer's invoice has no buyer account, so only
 * staff upload for it.
 */
export async function submitProof(
  form: FormData | null,
  by: { userId: string; name: string; customerId?: number },
  allow: (product: string) => boolean | string = () => true
): Promise<ProofResult> {
  const fail = (error: string, status = 400): ProofResult => ({ ok: false, error, status });
  if (!form) return fail("Choose a file to upload.");
  const file = form.get("file");
  const kind = form.get("kind");
  const id = Number(form.get("id"));
  const amount = Math.round(Number(form.get("amount")));
  const reference = String(form.get("reference") ?? "").trim().slice(0, 120);
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  if (!(file instanceof File) || file.size === 0) return fail("Choose a file to upload.");
  if (file.size > PROOF_MAX_BYTES) return fail("That file is over 5 MB — take a smaller photo or screenshot.");
  if ((kind !== "order" && kind !== "invoice") || !Number.isInteger(id) || id <= 0) return fail("That wasn't found.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter the amount paid.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffType(bytes);
  if (!mimeType) return fail("Upload a photo (JPEG, PNG or WebP) or a PDF of the receipt.");

  // The unpaid order or invoice — a buyer's own only.
  const mine = by.customerId !== undefined ? { customerId: by.customerId } : {};
  let customerId: number | null;
  let what: string;
  // What was sold, and the walk-in buyer's name when there's no account.
  let product = "Eggs (crates)";
  let walkIn = "";
  if (kind === "order") {
    const o = await prisma.eggOrder.findFirst({
      where: { id, ...mine },
      select: { customerId: true, status: true, paidAt: true },
    });
    if (!o) return fail("That order wasn't found.", 404);
    if (o.paidAt) return fail("That order is already paid for.");
    if (o.status !== "pending") return fail("That order was released or closed.");
    customerId = o.customerId;
    what = `order #${id}`;
  } else {
    const v = await prisma.invoice.findFirst({
      where: { id, ...mine },
      select: { customerId: true, status: true, product: true, name: true },
    });
    // A walk-in's invoice has no account, so no buyer can claim it.
    if (!v || (v.customerId === null && by.customerId !== undefined)) return fail("That invoice wasn't found.", 404);
    if (v.status === "paid") return fail("That invoice is already paid.");
    customerId = v.customerId;
    product = v.product;
    walkIn = v.name;
    what = invNo(id);
  }
  const customer =
    customerId === null
      ? null
      : await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, archivedAt: true },
        });
  if (customerId !== null && (!customer || customer.archivedAt)) return fail("That buyer isn't active.", 403);
  const allowed = allow(product);
  if (allowed !== true) return fail(typeof allowed === "string" ? allowed : "That isn't allowed.", 403);

  const open = await prisma.paymentProof.count({
    where: { status: "submitted", ...(kind === "order" ? { orderId: id } : { invoiceId: id }) },
  });
  if (open >= PROOF_MAX_OPEN) {
    return fail(`There are already ${PROOF_MAX_OPEN} receipts waiting to be checked on it — wait for the farm to check them.`);
  }

  // Several receipts for one payment arrive together: one alert for the lot.
  const justSent = await prisma.paymentProof.count({
    where: {
      ...(kind === "order" ? { orderId: id } : { invoiceId: id }),
      createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) },
    },
  });

  const proof = await saveProof({
    customerId,
    orderId: kind === "order" ? id : null,
    invoiceId: kind === "invoice" ? id : null,
    amount,
    reference,
    note,
    fileName: file.name,
    mimeType,
    bytes,
    uploadedBy: by.name,
  });
  const buyerName = customer?.name ?? walkIn;
  const onBehalf = by.customerId === undefined ? ` for ${buyerName}` : "";
  await audit({
    userId: by.userId,
    actor: by.name,
    action: "uploadProof",
    summary: `receipt${onBehalf} for ${what} · ${naira.format(amount)}${reference ? ` · ref ${reference}` : ""}`,
    details: { proofId: proof.id, kind, id, customerId, amount, reference, size: file.size, mimeType },
  });
  // A buyer's upload needs someone to check it.
  if (by.customerId !== undefined && justSent === 0) {
    later(() =>
      alertAdmins(
        "A payment receipt to check",
        `${buyerName} uploaded a receipt for ${what}: ${naira.format(amount)}${reference ? ` (ref ${reference})` : ""}. Check it on ${
          kind === "order" ? "Egg orders" : "Sales & invoices"
        } and mark it paid.`
      )
    );
  }
  return { ok: true, id: proof.id };
}
