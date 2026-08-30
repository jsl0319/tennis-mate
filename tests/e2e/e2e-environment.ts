export const E2E_BASE_URL = "http://127.0.0.1:3100";
export const E2E_AUTH_SECRET = "tennis-mate-e2e-only-auth-secret";

export function requireE2eDatabaseUrl() {
  const value = process.env.E2E_DATABASE_URL;
  if (!value?.trim()) throw new Error("E2E_DATABASE_URL을 설정한 뒤 전용 E2E DB에 migration을 적용해 주세요.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("E2E_DATABASE_URL은 PostgreSQL 연결 문자열이어야 합니다.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("E2E_DATABASE_URL은 PostgreSQL 연결 문자열이어야 합니다.");
  }

  const databaseName = url.pathname.replace(/^\/+/, "").toLowerCase();
  if (!databaseName.includes("e2e")) {
    throw new Error("안전을 위해 E2E_DATABASE_URL의 DB 이름에는 e2e가 포함되어야 합니다.");
  }

  return url.toString();
}
