import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// `vercel env pull` stores development values in .env.local. Keep .env as a
// fallback so a conventional local PostgreSQL setup continues to work.
config({ path: ".env.local" });
config();

const migrationDatabaseUrl = process.env.DATABASE_URL_UNPOOLED ?? env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationDatabaseUrl,
  },
});
