import { del, get, put } from "@vercel/blob";

import type { PrismaClient } from "@/generated/prisma/client";
import type { OperatorCourtImageSaveInput } from "@/server/domain/court-slot";
import { DomainError } from "@/server/domain/profile-service";

export const operatorCourtImageContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxOperatorCourtImageBytes = 10 * 1024 * 1024;
export const maxOperatorCourtImages = 3;
export const pendingOperatorCourtImageLifetimeMs = 24 * 60 * 60 * 1000;

type OperatorCourtImageContentType = (typeof operatorCourtImageContentTypes)[number];
type CleanupCandidate = {
  id: string;
  privateObjectRef: string;
  status: "PENDING" | "ATTACHED" | "REPLACED";
  createdAt: Date;
  expiresAt: Date | null;
};

function isOperatorCourtImageContentType(value: string): value is OperatorCourtImageContentType {
  return (operatorCourtImageContentTypes as readonly string[]).includes(value);
}

function hasExpectedSignature(contentType: OperatorCourtImageContentType, bytes: Buffer) {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function extensionFor(contentType: OperatorCourtImageContentType) {
  return contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
}

async function getOwnedPublishedCourt(prisma: PrismaClient, viewer: { id: string }, courtId: string) {
  const court = await prisma.court.findFirst({
    where: { id: courtId, operatorApplication: { applicantUserId: viewer.id } },
    select: { id: true, operatorApplication: { select: { status: true } } },
  });
  if (!court) throw new DomainError("COURT_NOT_FOUND", 404, "코트장을 찾을 수 없어요.");
  if (court.operatorApplication.status !== "PUBLISH_APPROVED") {
    throw new DomainError("OPERATOR_PUBLISH_APPROVAL_REQUIRED", 403, "대표 코트 사진은 공개 승인 후 관리할 수 있어요.");
  }
  return court;
}

function operatorImageUrl(courtId: string, imageId: string) {
  return `/api/v1/operator/courts/${courtId}/images/${imageId}`;
}

function toOperatorCourtImageViewForCourt(courtId: string, image: { id: string; isRepresentative: boolean; sortOrder: number }) {
  return {
    id: image.id,
    url: operatorImageUrl(courtId, image.id),
    isRepresentative: image.isRepresentative,
    sortOrder: image.sortOrder,
  };
}

export async function listOperatorCourtImages(prisma: PrismaClient, viewer: { id: string }, courtId: string) {
  await getOwnedPublishedCourt(prisma, viewer, courtId);
  const items = await prisma.courtImage.findMany({
    where: { courtId, ownerUserId: viewer.id, status: "ATTACHED" },
    select: { id: true, isRepresentative: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return { items: items.map((image) => toOperatorCourtImageViewForCourt(courtId, image)) };
}

export async function createOperatorCourtImageUpload(prisma: PrismaClient, viewer: { id: string }, courtId: string, file: File) {
  const court = await getOwnedPublishedCourt(prisma, viewer, courtId);
  if (!isOperatorCourtImageContentType(file.type)) {
    throw new DomainError("OPERATOR_COURT_IMAGE_TYPE_NOT_ALLOWED", 422, "코트 사진은 JPEG, PNG, WebP만 올릴 수 있어요.");
  }
  if (file.size < 1 || file.size > maxOperatorCourtImageBytes) {
    throw new DomainError("OPERATOR_COURT_IMAGE_SIZE_INVALID", 422, "코트 사진은 10 MiB 이하로 올려 주세요.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !hasExpectedSignature(file.type, bytes)) {
    throw new DomainError("OPERATOR_COURT_IMAGE_SIGNATURE_INVALID", 422, "사진 파일 형식을 다시 확인해 주세요.");
  }

  const [attachedCount, pendingCount] = await Promise.all([
    prisma.courtImage.count({ where: { courtId: court.id, ownerUserId: viewer.id, status: "ATTACHED" } }),
    prisma.courtImage.count({ where: { courtId: court.id, ownerUserId: viewer.id, status: "PENDING" } }),
  ]);
  const pendingLimit = attachedCount >= maxOperatorCourtImages ? 1 : maxOperatorCourtImages - attachedCount;
  if (pendingCount >= pendingLimit) {
    throw new DomainError("OPERATOR_COURT_IMAGE_UPLOAD_LIMIT", 409, "사진을 저장하거나 선택을 취소한 뒤 다시 올려 주세요.");
  }

  const blob = await put(
    `operator-court-images/${court.id}/${viewer.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`,
    bytes,
    { access: "private", contentType: file.type, addRandomSuffix: false },
  );

  try {
    return await prisma.courtImage.create({
      data: {
        courtId: court.id,
        ownerUserId: viewer.id,
        privateObjectRef: blob.url,
        contentType: file.type,
        byteSize: bytes.length,
      },
      select: { id: true },
    });
  } catch (error) {
    await del(blob.url).catch(() => undefined);
    throw error;
  }
}

export async function saveOperatorCourtImages(
  prisma: PrismaClient,
  viewer: { id: string },
  courtId: string,
  input: OperatorCourtImageSaveInput,
  now = new Date(),
) {
  await getOwnedPublishedCourt(prisma, viewer, courtId);
  const result = await prisma.$transaction(async (transaction) => {
    const lockedCourt = await transaction.court.updateMany({
      where: { id: courtId, operatorApplication: { applicantUserId: viewer.id, status: "PUBLISH_APPROVED" } },
      data: { updatedAt: now },
    });
    if (lockedCourt.count !== 1) {
      throw new DomainError("OPERATOR_PUBLISH_APPROVAL_REQUIRED", 403, "대표 코트 사진은 공개 승인 후 관리할 수 있어요.");
    }

    const requested = await transaction.courtImage.findMany({
      where: {
        id: { in: input.imageIds },
        courtId,
        ownerUserId: viewer.id,
        status: { in: ["PENDING", "ATTACHED"] },
      },
      select: { id: true },
    });
    if (requested.length !== input.imageIds.length) {
      throw new DomainError("OPERATOR_COURT_IMAGE_UNAVAILABLE", 409, "사진을 다시 올린 뒤 저장해 주세요.");
    }

    const current = await transaction.courtImage.findMany({
      where: { courtId, ownerUserId: viewer.id, status: "ATTACHED" },
      select: { id: true },
    });
    const replacedImageIds = current.filter((image) => !input.imageIds.includes(image.id)).map((image) => image.id);

    await transaction.courtImage.updateMany({
      where: { courtId, ownerUserId: viewer.id, status: "ATTACHED" },
      data: { status: "REPLACED", isRepresentative: false, expiresAt: now },
    });

    for (const [sortOrder, imageId] of input.imageIds.entries()) {
      await transaction.courtImage.update({
        where: { id: imageId },
        data: {
          status: "ATTACHED",
          attachedAt: now,
          expiresAt: null,
          cleanupClaimedAt: null,
          deletedAt: null,
          sortOrder,
          isRepresentative: imageId === input.representativeImageId,
        },
      });
    }

    const images = await transaction.courtImage.findMany({
      where: { courtId, ownerUserId: viewer.id, status: "ATTACHED" },
      select: { id: true, isRepresentative: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return { items: images.map((image) => toOperatorCourtImageViewForCourt(courtId, image)), replacedImageIds };
  });

  await Promise.all(result.replacedImageIds.map((imageId) => cleanupRemovedOperatorCourtImage(prisma, imageId, now)));
  return { items: result.items };
}

export async function removeOperatorCourtImage(prisma: PrismaClient, viewer: { id: string }, courtId: string, imageId: string, now = new Date()) {
  await getOwnedPublishedCourt(prisma, viewer, courtId);
  const removed = await prisma.courtImage.updateMany({
    where: { id: imageId, courtId, ownerUserId: viewer.id, status: { in: ["PENDING", "ATTACHED"] } },
    data: { status: "REPLACED", isRepresentative: false, expiresAt: now },
  });
  if (removed.count !== 1) throw new DomainError("OPERATOR_COURT_IMAGE_NOT_FOUND", 404, "코트 사진을 찾을 수 없어요.");
  await cleanupRemovedOperatorCourtImage(prisma, imageId, now);
}

export async function getOperatorCourtImageObjectRef(prisma: PrismaClient, viewer: { id: string }, courtId: string, imageId: string) {
  const image = await prisma.courtImage.findFirst({
    where: {
      id: imageId,
      courtId,
      ownerUserId: viewer.id,
      status: "ATTACHED",
      court: { operatorApplication: { applicantUserId: viewer.id, status: "PUBLISH_APPROVED" } },
    },
    select: { privateObjectRef: true },
  });
  if (!image) throw new DomainError("OPERATOR_COURT_IMAGE_NOT_FOUND", 404, "코트 사진을 찾을 수 없어요.");
  return image.privateObjectRef;
}

export async function getPublicCourtImageObjectRef(prisma: PrismaClient, courtId: string) {
  const image = await prisma.courtImage.findFirst({
    where: {
      courtId,
      status: "ATTACHED",
      isRepresentative: true,
      court: {
        operatorApplication: { status: "PUBLISH_APPROVED" },
        units: { some: { slots: { some: { visibility: "PUBLIC" } } } },
      },
    },
    select: { privateObjectRef: true },
  });
  if (!image) throw new DomainError("PARTNER_COURT_NOT_FOUND", 404, "코트를 찾을 수 없어요.");
  return image.privateObjectRef;
}

export async function getPrivateOperatorCourtImage(objectRef: string, ifNoneMatch: string | null) {
  return get(objectRef, { access: "private", ...(ifNoneMatch ? { ifNoneMatch } : {}) });
}

function cleanupWhere(candidate: CleanupCandidate, now: Date) {
  if (candidate.status === "PENDING") {
    return { id: candidate.id, status: "PENDING" as const, createdAt: { lt: new Date(now.getTime() - pendingOperatorCourtImageLifetimeMs) } };
  }
  if (candidate.status === "ATTACHED") {
    return { id: candidate.id, status: "ATTACHED" as const, expiresAt: { lte: now } };
  }
  return { id: candidate.id, status: "REPLACED" as const };
}

async function cleanupCandidate(prisma: PrismaClient, candidate: CleanupCandidate, now: Date) {
  const claimed = await prisma.courtImage.updateMany({
    where: cleanupWhere(candidate, now),
    data: { status: "CLEANUP_PENDING", cleanupClaimedAt: now, isRepresentative: false },
  });
  if (claimed.count !== 1) return { deleted: false, failed: false };

  try {
    await del(candidate.privateObjectRef);
    await prisma.courtImage.updateMany({
      where: { id: candidate.id, status: "CLEANUP_PENDING" },
      data: { status: "DELETED", deletedAt: now },
    });
    return { deleted: true, failed: false };
  } catch {
    await prisma.courtImage.updateMany({
      where: { id: candidate.id, status: "CLEANUP_PENDING" },
      data: { status: candidate.status, cleanupClaimedAt: null },
    });
    return { deleted: false, failed: true };
  }
}

async function cleanupRemovedOperatorCourtImage(prisma: PrismaClient, imageId: string, now: Date) {
  const image = await prisma.courtImage.findFirst({
    where: { id: imageId, status: "REPLACED" },
    select: { id: true, privateObjectRef: true, status: true, createdAt: true, expiresAt: true },
  });
  if (!image || image.status !== "REPLACED") return;
  await cleanupCandidate(prisma, image as CleanupCandidate, now);
}

export async function cleanupOperatorCourtImages(prisma: PrismaClient, now = new Date()) {
  const pendingExpiresBefore = new Date(now.getTime() - pendingOperatorCourtImageLifetimeMs);
  const candidates = await prisma.courtImage.findMany({
    where: {
      OR: [
        { status: "PENDING", createdAt: { lt: pendingExpiresBefore } },
        { status: "REPLACED" },
        { status: "ATTACHED", expiresAt: { lte: now } },
      ],
    },
    select: { id: true, privateObjectRef: true, status: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let deleted = 0;
  let failed = 0;
  for (const candidate of candidates) {
    if (candidate.status !== "PENDING" && candidate.status !== "ATTACHED" && candidate.status !== "REPLACED") continue;
    const result = await cleanupCandidate(prisma, candidate as CleanupCandidate, now);
    if (result.deleted) deleted += 1;
    if (result.failed) failed += 1;
  }
  return { checked: candidates.length, deleted, failed };
}
