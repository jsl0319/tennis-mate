import { NextResponse } from "next/server";

import { getPrisma } from "@/server/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      checkedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "데이터베이스 연결에 실패했습니다.";

    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        message,
        checkedAt,
      },
      { status: 503 },
    );
  }
}
