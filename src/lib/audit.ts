import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Keys never written to the log. */
const SECRET = /password|token|secret/i;

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET.test(k) ? "•••" : scrub(v)])
    );
  }
  return value;
}

/** "house H-01 · eggs 2100 · cracked 12" — the input at a glance. */
export function brief(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (typeof input !== "object") return String(input);
  return Object.entries(scrub(input) as Record<string, unknown>)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ")
    .slice(0, 240);
}

/**
 * Appends to the audit log. Never throws: a logging hiccup must not undo or
 * fail the write it describes.
 */
export async function audit(entry: {
  userId: string | null;
  actor: string;
  action: string;
  summary: string;
  details?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        actor: entry.actor,
        action: entry.action,
        summary: entry.summary,
        details:
          entry.details === undefined
            ? Prisma.JsonNull
            : (JSON.parse(JSON.stringify(scrub(entry.details))) as Prisma.InputJsonValue),
      },
    });
  } catch (e) {
    console.error("audit log write failed", e);
  }
}
