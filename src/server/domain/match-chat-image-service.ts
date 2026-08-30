import { del, get, put } from "@vercel/blob";

import type { PrismaClient } from "@/generated/prisma/client";
import { findMatchConversationForMember, requireOpenMatchConversationForSending } from "@/server/domain/match-chat-service";
import { DomainError } from "@/server/domain/profile-service";

export const matchChatImageContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxMatchChatImageBytes = 5 * 1024 * 1024;
export const maxMatchChatImagesPerMessage = 3;
export const pendingMatchChatImageLifetimeMs = 24 * 60 * 60 * 1000;

type MatchChatImageContentType = (typeof matchChatImageContentTypes)[number];

function isMatchChatImageContentType(value: string): value is MatchChatImageContentType {
  return (matchChatImageContentTypes as readonly string[]).includes(value);
}

function hasExpectedSignature(contentType: MatchChatImageContentType, bytes: Buffer) {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function extensionFor(contentType: MatchChatImageContentType) {
  return contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
}

function validateImage(file: File) {
  if (!isMatchChatImageContentType(file.type)) {
    throw new DomainError("CHAT_IMAGE_TYPE_NOT_ALLOWED", 422, "채팅 사진은 JPEG, PNG, WebP만 올릴 수 있어요.");
  }
  if (file.size < 1 || file.size > maxMatchChatImageBytes) {
    throw new DomainError("CHAT_IMAGE_SIZE_INVALID", 422, "채팅 사진은 5 MiB 이하로 올려 주세요.");
  }
  return file.type;
}

export async function createMatchChatImageUpload(prisma: PrismaClient, userId: string, matchId: string, file: File) {
  const contentType = validateImage(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !hasExpectedSignature(contentType, bytes)) {
    throw new DomainError("CHAT_IMAGE_SIGNATURE_INVALID", 422, "사진 파일 형식을 다시 확인해 주세요.");
  }

  const initialConversation = await prisma.$transaction((transaction) => requireOpenMatchConversationForSending(transaction, userId, matchId));
  const blob = await put(
    `match-chat-images/${initialConversation.conversation.id}/${userId}/${crypto.randomUUID()}.${extensionFor(contentType)}`,
    bytes,
    { access: "private", contentType, addRandomSuffix: false },
  );

  try {
    return await prisma.$transaction(async (transaction) => {
      const { conversation } = await requireOpenMatchConversationForSending(transaction, userId, matchId);
      const pendingCount = await transaction.matchChatImageUpload.count({
        where: { conversationId: conversation.id, ownerUserId: userId, status: "PENDING" },
      });
      if (pendingCount >= maxMatchChatImagesPerMessage) {
        throw new DomainError("CHAT_IMAGE_UPLOAD_LIMIT", 409, "사진을 전송하거나 선택을 취소한 뒤 다시 올려 주세요.");
      }
      return transaction.matchChatImageUpload.create({
        data: {
          conversationId: conversation.id,
          ownerUserId: userId,
          privateObjectRef: blob.url,
          contentType,
          byteSize: bytes.length,
        },
        select: { id: true },
      });
    });
  } catch (error) {
    await del(blob.url).catch(() => undefined);
    throw error;
  }
}

export async function discardMatchChatImageUpload(prisma: PrismaClient, userId: string, matchId: string, imageUploadId: string) {
  const candidate = await prisma.$transaction(async (transaction) => {
    const { conversation } = await findMatchConversationForMember(transaction, matchId, userId);
    const image = await transaction.matchChatImageUpload.findFirst({
      where: { id: imageUploadId, conversationId: conversation.id, ownerUserId: userId, status: "PENDING" },
      select: { id: true, privateObjectRef: true },
    });
    if (!image) throw new DomainError("CHAT_IMAGE_UPLOAD_NOT_FOUND", 404, "채팅 사진을 찾을 수 없어요.");
    const claimed = await transaction.matchChatImageUpload.updateMany({
      where: { id: image.id, status: "PENDING" },
      data: { status: "CLEANUP_PENDING", cleanupClaimedAt: new Date() },
    });
    if (claimed.count !== 1) throw new DomainError("CHAT_IMAGE_UPLOAD_NOT_FOUND", 404, "채팅 사진을 찾을 수 없어요.");
    return image;
  });

  try {
    await del(candidate.privateObjectRef);
    await prisma.matchChatImageUpload.updateMany({
      where: { id: candidate.id, status: "CLEANUP_PENDING" },
      data: { status: "DELETED", deletedAt: new Date() },
    });
  } catch (error) {
    await prisma.matchChatImageUpload.updateMany({
      where: { id: candidate.id, status: "CLEANUP_PENDING" },
      data: { status: "PENDING", cleanupClaimedAt: null },
    });
    throw error;
  }
}

export async function getMatchChatImageObjectRefForMember(prisma: PrismaClient, userId: string, matchId: string, messageId: string, imageUploadId: string) {
  const { conversation } = await findMatchConversationForMember(prisma, matchId, userId);
  const image = await prisma.matchChatImageUpload.findFirst({
    where: {
      id: imageUploadId,
      conversationId: conversation.id,
      messageId,
      status: "ATTACHED",
      message: { id: messageId, conversationId: conversation.id, visibility: "VISIBLE" },
    },
    select: { privateObjectRef: true },
  });
  if (!image) throw new DomainError("MATCH_CONVERSATION_NOT_FOUND", 404, "채팅방을 찾을 수 없어요.");
  return image.privateObjectRef;
}

export async function getPrivateMatchChatImage(objectRef: string, ifNoneMatch: string | null) {
  return get(objectRef, { access: "private", ...(ifNoneMatch ? { ifNoneMatch } : {}) });
}

export async function cleanupPendingMatchChatImageUploads(prisma: PrismaClient, now = new Date()) {
  const expiresBefore = new Date(now.getTime() - pendingMatchChatImageLifetimeMs);
  const candidates = await prisma.matchChatImageUpload.findMany({
    where: { status: "PENDING", createdAt: { lt: expiresBefore } },
    select: { id: true, privateObjectRef: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let deleted = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const claimed = await prisma.matchChatImageUpload.updateMany({
      where: { id: candidate.id, status: "PENDING", createdAt: { lt: expiresBefore } },
      data: { status: "CLEANUP_PENDING", cleanupClaimedAt: now },
    });
    if (claimed.count !== 1) continue;
    try {
      await del(candidate.privateObjectRef);
      await prisma.matchChatImageUpload.updateMany({
        where: { id: candidate.id, status: "CLEANUP_PENDING" },
        data: { status: "DELETED", deletedAt: now },
      });
      deleted += 1;
    } catch {
      failed += 1;
      await prisma.matchChatImageUpload.updateMany({
        where: { id: candidate.id, status: "CLEANUP_PENDING" },
        data: { status: "PENDING", cleanupClaimedAt: null },
      });
    }
  }
  return { checked: candidates.length, deleted, failed };
}
