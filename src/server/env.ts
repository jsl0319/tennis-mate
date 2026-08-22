import { z } from "zod";

const databaseUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL은 PostgreSQL 연결 문자열이어야 합니다.",
  );

export function parseDatabaseUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }

  const result = databaseUrlSchema.safeParse(value);

  if (!result.success) {
    const message =
      result.error.issues[0]?.message ?? "DATABASE_URL 설정을 확인해 주세요.";
    throw new Error(message);
  }

  const url = new URL(result.data);
  const sslmode = url.searchParams.get("sslmode");

  if (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

export function getDatabaseUrl(): string {
  return parseDatabaseUrl(process.env.DATABASE_URL);
}
