import { NextResponse } from "next/server";

import { getPrisma } from "@/server/db/prisma";
import { reconcileStartedMatches } from "@/server/domain/match-service";

export const runtime = "nodejs";

function hasValidCronSecret(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const result = await reconcileStartedMatches(getPrisma());

    console.info({ event: "cron.reconcile_started_matches.completed", ...result });

    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error({
      event: "cron.reconcile_started_matches.failed",
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return NextResponse.json(
      { status: "error", message: "상태 보정 작업을 완료하지 못했어요." },
      { status: 500 },
    );
  }
}
