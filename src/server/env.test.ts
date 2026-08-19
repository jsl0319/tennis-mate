import { describe, expect, it } from "vitest";

import { parseDatabaseUrl } from "./env";

describe("parseDatabaseUrl", () => {
  it("accepts a PostgreSQL connection string", () => {
    expect(
      parseDatabaseUrl("postgresql://user:password@localhost:5432/tennis_mate"),
    ).toBe("postgresql://user:password@localhost:5432/tennis_mate");
  });

  it("explains when the value is missing", () => {
    expect(() => parseDatabaseUrl(undefined)).toThrow(
      "DATABASE_URL이 설정되지 않았습니다.",
    );
  });

  it("rejects a non-PostgreSQL connection string", () => {
    expect(() => parseDatabaseUrl("mysql://localhost/tennis_mate")).toThrow(
      "DATABASE_URL은 PostgreSQL 연결 문자열이어야 합니다.",
    );
  });
});
