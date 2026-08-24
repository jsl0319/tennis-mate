import { del, get, put } from "@vercel/blob";

import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/server/domain/profile-service";

export const courtImageContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxCourtImageBytes = 4 * 1024 * 1024;
const pendingUploadLifetimeMs = 24 * 60 * 60 * 1000;

type CourtImageContentType = (typeof courtImageContentTypes)[number];
type CourtImageViewer = { id: string };

function isCourtImageContentType(value: string): value is CourtImageContentType {
  return (courtImageContentTypes as readonly string[]).includes(value);
}

function hasExpectedSignature(contentType: CourtImageContentType, bytes: Buffer) {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function extensionFor(contentType: CourtImageContentType) {
  return contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
}

export async function createCourtImageUpload(prisma: PrismaClient, ownerUserId: string, file: File) {
  if (!isCourtImageContentType(file.type)) {
    throw new DomainError("COURT_IMAGE_TYPE_NOT_ALLOWED", 422, "코트 사진은 JPEG, PNG, WebP만 올릴 수 있어요.");
  }

  if (file.size < 1 || file.size > maxCourtImageBytes) {
    throw new DomainError("COURT_IMAGE_SIZE_INVALID", 422, "코트 사진은 4 MiB 이하로 올려 주세요.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !hasExpectedSignature(file.type, bytes)) {
    throw new DomainError("COURT_IMAGE_SIGNATURE_INVALID", 422, "사진 파일 형식을 다시 확인해 주세요.");
  }

  const blob = await put(
    `court-images/${ownerUserId}/${crypto.randomUUID()}.${extensionFor(file.type)}`,
    bytes,
    { access: "private", contentType: file.type, addRandomSuffix: false },
  );

  try {
    return await prisma.courtImageUpload.create({
      data: {
        ownerUserId,
        privateObjectRef: blob.url,
        contentType: blob.contentType,
        byteSize: bytes.length,
      },
      select: { id: true },
    });
  } catch (error) {
    await del(blob.url).catch(() => undefined);
    throw error;
  }
}

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

export async function cleanupPendingCourtImageUploads(prisma: PrismaClient, now = new Date()) {
  const expiresBefore = new Date(now.getTime() - pendingUploadLifetimeMs);
  const candidates = await prisma.courtImageUpload.findMany({
    where: { status: "PENDING", createdAt: { lt: expiresBefore } },
    select: { id: true, privateObjectRef: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let deleted = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const claimed = await prisma.courtImageUpload.updateMany({
      where: { id: candidate.id, status: "PENDING", createdAt: { lt: expiresBefore } },
      data: { status: "CLEANUP_PENDING", cleanupClaimedAt: now },
    });
    if (claimed.count !== 1) continue;

    try {
      await del(candidate.privateObjectRef);
      await prisma.courtImageUpload.updateMany({
        where: { id: candidate.id, status: "CLEANUP_PENDING" },
        data: { status: "DELETED", deletedAt: now },
      });
      deleted += 1;
    } catch {
      failed += 1;
      await prisma.courtImageUpload.updateMany({
        where: { id: candidate.id, status: "CLEANUP_PENDING" },
        data: { status: "PENDING", cleanupClaimedAt: null },
      });
    }
  }

  return { checked: candidates.length, deleted, failed };
}
