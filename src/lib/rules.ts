import "server-only";

import type { prisma } from "@/lib/db";

/** A rule the user broke — its message is safe to show them. */
export class RuleError extends Error {}

/** The client inside `prisma.$transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
