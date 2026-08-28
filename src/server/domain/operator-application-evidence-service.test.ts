import { beforeEach, describe, expect, it, vi } from "vitest";

const { del, get, put } = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ del, get, put }));

import {
  claimBusinessRegistrationCertificate,
  cleanupOperatorApplicationEvidenceUploads,
  createBusinessRegistrationCertificateUpload,
  getBusinessRegistrationCertificateObjectRefForReviewer,
} from "./operator-application-evidence-service";

function pdfFile(bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])) {
  return new File([bytes], "business-registration.pdf", { type: "application/pdf" });
}

describe("operator application evidence service", () => {
  beforeEach(() => {
    del.mockReset();
    get.mockReset();
    put.mockReset();
  });

  it("stores only a private object reference and opaque upload id for a valid certificate", async () => {
    put.mockResolvedValue({ url: "https://blob.example/private/evidence.pdf", contentType: "application/pdf" });
    const create = vi.fn().mockResolvedValue({ id: "upload-id" });
    const prisma = { operatorApplicationEvidenceUpload: { create } };

    await expect(createBusinessRegistrationCertificateUpload(prisma as never, "owner-id", pdfFile())).resolves.toEqual({ id: "upload-id" });

    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^operator-application-evidence\/owner-id\/.+\.pdf$/),
      expect.any(Buffer),
      { access: "private", contentType: "application/pdf", addRandomSuffix: false },
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerUserId: "owner-id", contentType: "application/pdf", byteSize: 8 }),
      select: { id: true },
    });
  });

  it("rejects a spoofed certificate before object storage", async () => {
    await expect(createBusinessRegistrationCertificateUpload({ operatorApplicationEvidenceUpload: {} } as never, "owner-id", new File(["not a pdf"], "business.pdf", { type: "application/pdf" }))).rejects.toMatchObject({
      code: "BUSINESS_REGISTRATION_CERTIFICATE_SIGNATURE_INVALID",
      status: 422,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("claims an applicant-owned pending upload atomically and rejects a stale concurrent claim", async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const transaction = { operatorApplicationEvidenceUpload: { updateMany } };
    const now = new Date("2026-08-28T01:00:00.000Z");

    await expect(claimBusinessRegistrationCertificate(transaction as never, "owner-id", "upload-id", now)).resolves.toEqual({ replacedUploadId: null });
    await expect(claimBusinessRegistrationCertificate(transaction as never, "owner-id", "upload-id", now)).rejects.toMatchObject({
      code: "OPERATOR_APPLICATION_EVIDENCE_UNAVAILABLE",
      status: 409,
    });
    expect(updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: "upload-id", ownerUserId: "owner-id", status: "PENDING" },
      data: expect.objectContaining({ status: "ATTACHED", attachedAt: now }),
    }));
  });

  it("limits the certificate object reference to internal reviewers with an attached upload", async () => {
    const findUnique = vi.fn().mockResolvedValue({ businessRegistrationCertificate: { privateObjectRef: "https://blob.example/private/evidence.pdf", status: "ATTACHED" } });
    const prisma = { courtOperatorApplication: { findUnique } };

    await expect(getBusinessRegistrationCertificateObjectRefForReviewer(prisma as never, { role: "MEMBER" }, "application-id")).rejects.toMatchObject({ code: "INTERNAL_REVIEWER_REQUIRED", status: 403 });
    await expect(getBusinessRegistrationCertificateObjectRefForReviewer(prisma as never, { role: "INTERNAL_REVIEWER" }, "application-id")).resolves.toBe("https://blob.example/private/evidence.pdf");
  });

  it("claims an expired attached document before deleting its private object", async () => {
    const now = new Date("2030-01-02T00:00:00.000Z");
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    const prisma = {
      operatorApplicationEvidenceUpload: {
        findMany: vi.fn().mockResolvedValue([{ id: "upload-id", privateObjectRef: "https://blob.example/private/evidence.pdf", status: "ATTACHED", createdAt: new Date("2030-01-01T00:00:00.000Z"), expiresAt: new Date("2030-01-01T23:00:00.000Z") }]),
        updateMany,
      },
    };
    del.mockResolvedValue(undefined);

    await expect(cleanupOperatorApplicationEvidenceUploads(prisma as never, now)).resolves.toEqual({ checked: 1, deleted: 1, failed: 0 });
    expect(updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: "upload-id", status: "ATTACHED", expiresAt: { lte: now } },
      data: { status: "CLEANUP_PENDING", cleanupClaimedAt: now },
    }));
    expect(del).toHaveBeenCalledWith("https://blob.example/private/evidence.pdf");
  });
});
