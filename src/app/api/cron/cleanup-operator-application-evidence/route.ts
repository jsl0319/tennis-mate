import { NextResponse } from "next/server";

import { getPrisma } from "@/server/db/prisma";
import { cleanupOperatorApplicationEvidenceUploads } from "@/server/domain/operator-application-evidence-service";

export const runtime = "nodejs";

function hasValidCronSecret(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) return NextResponse.json({ status: "unauthorized" }, { status: 401 });

  try {
    const result = await cleanupOperatorApplicationEvidenceUploads(getPrisma());
    console.info({ event: "cron.cleanup_operator_application_evidence.completed", ...result });
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error({ event: "cron.cleanup_operator_application_evidence.failed", name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ status: "error", message: "만료된 사업자등록증 정리를 완료하지 못했어요." }, { status: 500 });
  }
}
