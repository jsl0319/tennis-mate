import { del, get, put } from "@vercel/blob";

import { type Prisma, type PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/server/domain/profile-service";

export const businessRegistrationCertificateContentTypes = ["application/pdf", "image/jpeg", "image/png"] as const;
export const maxBusinessRegistrationCertificateBytes = 10 * 1024 * 1024;
export const pendingOperatorApplicationEvidenceLifetimeMs = 24 * 60 * 60 * 1000;
export const attachedOperatorApplicationEvidenceLifetimeMs = 30 * 24 * 60 * 60 * 1000;

type BusinessRegistrationCertificateContentType = (typeof businessRegistrationCertificateContentTypes)[number];
type OperatorApplicationEvidenceTransaction = Prisma.TransactionClient;

function isBusinessRegistrationCertificateContentType(value: string): value is BusinessRegistrationCertificateContentType {
  return (businessRegistrationCertificateContentTypes as readonly string[]).includes(value);
}

function hasExpectedSignature(contentType: BusinessRegistrationCertificateContentType, bytes: Buffer) {
  if (contentType === "application/pdf") return bytes.length >= 5 && bytes.subarray(0, 5).equals(Buffer.from("%PDF-"));
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function extensionFor(contentType: BusinessRegistrationCertificateContentType) {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/jpeg") return "jpg";
  return "png";
}

function expiresAtFrom(now: Date) {
  return new Date(now.getTime() + attachedOperatorApplicationEvidenceLifetimeMs);
}

export async function createBusinessRegistrationCertificateUpload(prisma: PrismaClient, ownerUserId: string, file: File) {
  if (!isBusinessRegistrationCertificateContentType(file.type)) {
    throw new DomainError("BUSINESS_REGISTRATION_CERTIFICATE_TYPE_NOT_ALLOWED", 422, "사업자등록증은 PDF, JPEG, PNG만 올릴 수 있어요.");
  }
  if (file.size < 1 || file.size > maxBusinessRegistrationCertificateBytes) {
    throw new DomainError("BUSINESS_REGISTRATION_CERTIFICATE_SIZE_INVALID", 422, "사업자등록증은 10 MiB 이하로 올려 주세요.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || !hasExpectedSignature(file.type, bytes)) {
    throw new DomainError("BUSINESS_REGISTRATION_CERTIFICATE_SIGNATURE_INVALID", 422, "사업자등록증 파일 형식을 다시 확인해 주세요.");
  }

  const blob = await put(
    `operator-application-evidence/${ownerUserId}/${crypto.randomUUID()}.${extensionFor(file.type)}`,
    bytes,
    { access: "private", contentType: file.type, addRandomSuffix: false },
  );

  try {
    return await prisma.operatorApplicationEvidenceUpload.create({
      data: {
        ownerUserId,
        privateObjectRef: blob.url,
        contentType: file.type,
        byteSize: bytes.byteLength,
      },
      select: { id: true },
    });
  } catch (error) {
    try {
      await del(blob.url);
    } catch {
      // The scheduled cleanup can only see persisted metadata, so preserve the original DB error here.
    }
    throw error;
  }
}

export async function claimBusinessRegistrationCertificate(
  prisma: OperatorApplicationEvidenceTransaction,
  ownerUserId: string,
  uploadId: string,
  now: Date,
  currentUploadId?: string | null,
) {
  if (currentUploadId === uploadId) {
    const retained = await prisma.operatorApplicationEvidenceUpload.updateMany({
      where: { id: uploadId, ownerUserId, status: "ATTACHED" },
      data: { expiresAt: expiresAtFrom(now) },
    });
    if (retained.count !== 1) {
      throw new DomainError("OPERATOR_APPLICATION_EVIDENCE_UNAVAILABLE", 409, "사업자등록증을 다시 올려 주세요.");
    }
    return { replacedUploadId: null };
  }

  const claimed = await prisma.operatorApplicationEvidenceUpload.updateMany({
    where: { id: uploadId, ownerUserId, status: "PENDING" },
    data: { status: "ATTACHED", attachedAt: now, expiresAt: expiresAtFrom(now) },
  });
  if (claimed.count !== 1) {
    throw new DomainError("OPERATOR_APPLICATION_EVIDENCE_UNAVAILABLE", 409, "사업자등록증을 다시 올려 주세요.");
  }
  return { replacedUploadId: currentUploadId ?? null };
}

export async function replaceClaimedBusinessRegistrationCertificate(
  prisma: OperatorApplicationEvidenceTransaction,
  ownerUserId: string,
  replacedUploadId: string | null,
  now: Date,
) {
  if (!replacedUploadId) return;
  await prisma.operatorApplicationEvidenceUpload.updateMany({
    where: { id: replacedUploadId, ownerUserId, status: "ATTACHED" },
    data: { status: "REPLACED", expiresAt: now },
  });
}

export async function expireBusinessRegistrationCertificate(
  prisma: OperatorApplicationEvidenceTransaction,
  uploadId: string | null,
  now: Date,
) {
  if (!uploadId) return;
  await prisma.operatorApplicationEvidenceUpload.updateMany({
    where: { id: uploadId, status: "ATTACHED" },
    data: { expiresAt: now },
  });
}

export async function getBusinessRegistrationCertificateObjectRefForReviewer(
  prisma: PrismaClient,
  reviewer: { role: string },
  applicationId: string,
) {
  if (reviewer.role !== "INTERNAL_REVIEWER") {
    throw new DomainError("INTERNAL_REVIEWER_REQUIRED", 403, "내부 심사 권한이 필요해요.");
  }

  const application = await prisma.courtOperatorApplication.findUnique({
    where: { id: applicationId },
    select: {
      businessRegistrationCertificate: {
        select: { privateObjectRef: true, status: true },
      },
    },
  });
  const certificate = application?.businessRegistrationCertificate;
  if (!certificate || certificate.status !== "ATTACHED") {
    throw new DomainError("OPERATOR_APPLICATION_EVIDENCE_NOT_FOUND", 404, "사업자등록증을 찾을 수 없어요.");
  }
  return certificate.privateObjectRef;
}

export async function getPrivateOperatorApplicationEvidence(objectRef: string, ifNoneMatch: string | null) {
  return get(objectRef, { access: "private", ...(ifNoneMatch ? { ifNoneMatch } : {}) });
}

type CleanupCandidate = {
  id: string;
  privateObjectRef: string;
  status: "PENDING" | "ATTACHED" | "REPLACED";
  createdAt: Date;
  expiresAt: Date | null;
};

function cleanupWhere(candidate: CleanupCandidate, now: Date) {
  if (candidate.status === "PENDING") {
    return { id: candidate.id, status: "PENDING" as const, createdAt: { lt: new Date(now.getTime() - pendingOperatorApplicationEvidenceLifetimeMs) } };
  }
  if (candidate.status === "ATTACHED") {
    return { id: candidate.id, status: "ATTACHED" as const, expiresAt: { lte: now } };
  }
  return { id: candidate.id, status: "REPLACED" as const };
}

export async function cleanupOperatorApplicationEvidenceUploads(prisma: PrismaClient, now = new Date()) {
  const pendingExpiresBefore = new Date(now.getTime() - pendingOperatorApplicationEvidenceLifetimeMs);
  const candidates = await prisma.operatorApplicationEvidenceUpload.findMany({
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
    const cleanupCandidate = candidate as CleanupCandidate;
    const claimed = await prisma.operatorApplicationEvidenceUpload.updateMany({
      where: cleanupWhere(cleanupCandidate, now),
      data: { status: "CLEANUP_PENDING", cleanupClaimedAt: now },
    });
    if (claimed.count !== 1) continue;

    try {
      await del(cleanupCandidate.privateObjectRef);
      await prisma.operatorApplicationEvidenceUpload.updateMany({
        where: { id: cleanupCandidate.id, status: "CLEANUP_PENDING" },
        data: { status: "DELETED", deletedAt: now },
      });
      deleted += 1;
    } catch {
      failed += 1;
      await prisma.operatorApplicationEvidenceUpload.updateMany({
        where: { id: cleanupCandidate.id, status: "CLEANUP_PENDING" },
        data: { status: cleanupCandidate.status, cleanupClaimedAt: null },
      });
    }
  }

  return { checked: candidates.length, deleted, failed };
}
