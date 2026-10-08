import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Not env("DATABASE_URL"): that throws when unset, and `prisma generate`
    // runs at install/build time, where no database is needed.
    url: process.env.DATABASE_URL ?? "",
  },
});
