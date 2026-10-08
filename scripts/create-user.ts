/**
 * Creates a login. Staff accounts can only come from here.
 *
 *   npm run user:create -- --email ada@argandu.farm --name "Ada Okafor" --role staff
 *   npm run user:create -- --email buyer@shop.ng --name "Kano Fresh" --role customer --customer 5
 *
 * The password is read from the PASSWORD env var, or prompted for.
 */

import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { createCredentialUser } from "../src/lib/users";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "staff" },
    customer: { type: "string" },
  },
});

async function main() {
  const { email, name, role, customer } = values;
  if (!email || !name || (role !== "staff" && role !== "customer")) {
    throw new Error(
      'Usage: npm run user:create -- --email <email> --name "<name>" [--role staff|customer] [--customer <id>]'
    );
  }
  if (role === "customer" && !customer) {
    throw new Error("Customer logins need --customer <customer id>.");
  }

  let password = process.env.PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Password (8+ characters): ");
    rl.close();
  }
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const user = await createCredentialUser(prisma, {
      name,
      email,
      password,
      role,
      customerId: customer ? Number(customer) : undefined,
    });
    console.log(`Created ${role} login ${user.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
