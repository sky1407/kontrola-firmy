import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrácie potrebujú priame spojenie; Neon cez Vercel ho dáva v DATABASE_URL_UNPOOLED.
    // Aplikácia za behu používa pooled DATABASE_URL (pozri src/lib/db.ts).
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
