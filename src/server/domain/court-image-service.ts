import { get } from "@vercel/blob";

import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/server/domain/profile-service";

type CourtImageViewer = { id: string };

export async function getCourtImageObjectRefForViewer(prisma: PrismaClient, viewer: CourtImageViewer, matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      hostUserId: true,
      status: true,
      applications: { where: { applicantUserId: viewer.id }, select: { id: true } },
      externalCourtImageUpload: { select: { privateObjectRef: true, status: true } },
    },
  });

  const hasHistoryAccess = match?.hostUserId === viewer.id || Boolean(match?.applications.length);
  if (!match || !match.externalCourtImageUpload || match.externalCourtImageUpload.status !== "ATTACHED" || (match.status !== "OPEN" && !hasHistoryAccess)) {
    throw new DomainError("MATCH_NOT_FOUND", 404, "매칭을 찾을 수 없어요.");
  }

  return match.externalCourtImageUpload.privateObjectRef;
}

export async function getPrivateCourtImage(objectRef: string, ifNoneMatch: string | null) {
  return get(objectRef, {
    access: "private",
    ...(ifNoneMatch ? { ifNoneMatch } : {}),
  });
}
