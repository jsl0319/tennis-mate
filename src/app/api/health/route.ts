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
    console.error({
      event: "health.database_error",
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        message: "서비스 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
        checkedAt,
      },
      { status: 503 },
    );
  }
}
