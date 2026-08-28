import { beforeEach, describe, expect, it, vi } from "vitest";

const { del, get, put } = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ del, get, put }));

import {
  cleanupOperatorCourtImages,
  createOperatorCourtImageUpload,
  getPublicCourtImageObjectRef,
  saveOperatorCourtImages,
} from "./operator-court-image-service";

function jpegFile(bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00])) {
  return new File([bytes], "court.jpg", { type: "image/jpeg" });
}

function publishedCourt() {
  return { id: "court-id", status: "ACTIVE", operatorApplication: { status: "PUBLISH_APPROVED" } };
}

describe("operator court image service", () => {
  beforeEach(() => {
    del.mockReset();
    get.mockReset();
    put.mockReset();
  });

  it("stores a signed facility photo privately for the published court owner", async () => {
    put.mockResolvedValue({ url: "https://blob.example/private/court.jpg" });
    const create = vi.fn().mockResolvedValue({ id: "image-id" });
    const prisma = {
      court: { findFirst: vi.fn().mockResolvedValue(publishedCourt()) },
      courtImage: { count: vi.fn().mockResolvedValue(0), create },
    };

    await expect(createOperatorCourtImageUpload(prisma as never, { id: "operator-id" }, "court-id", jpegFile())).resolves.toEqual({ id: "image-id" });

    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^operator-court-images\/court-id\/operator-id\/.+\.jpg$/),
      expect.any(Buffer),
      { access: "private", contentType: "image/jpeg", addRandomSuffix: false },
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ courtId: "court-id", ownerUserId: "operator-id", byteSize: 4 }),
      select: { id: true },
    });
  });

  it("rejects a spoofed photo before it reaches private object storage", async () => {
    const prisma = { court: { findFirst: vi.fn().mockResolvedValue(publishedCourt()) } };

    await expect(createOperatorCourtImageUpload(prisma as never, { id: "operator-id" }, "court-id", jpegFile(new Uint8Array([0x00, 0x01, 0x02])))).rejects.toMatchObject({
      code: "OPERATOR_COURT_IMAGE_SIGNATURE_INVALID",
      status: 422,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("does not allow an operator without publish approval to upload a facility photo", async () => {
    const prisma = { court: { findFirst: vi.fn().mockResolvedValue({ id: "court-id", status: "ACTIVE", operatorApplication: { status: "DRAFT_ACCESS_GRANTED" } }) } };

    await expect(createOperatorCourtImageUpload(prisma as never, { id: "operator-id" }, "court-id", jpegFile())).rejects.toMatchObject({
      code: "OPERATOR_PUBLISH_APPROVAL_REQUIRED",
      status: 403,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps at most one unsaved replacement beside three saved photos", async () => {
    const prisma = {
      court: { findFirst: vi.fn().mockResolvedValue(publishedCourt()) },
      courtImage: { count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1) },
    };

    await expect(createOperatorCourtImageUpload(prisma as never, { id: "operator-id" }, "court-id", jpegFile())).rejects.toMatchObject({
      code: "OPERATOR_COURT_IMAGE_UPLOAD_LIMIT",
      status: 409,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("serializes saving on the court row and stores only the requested representative selection", async () => {
    const transaction = {
      court: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      courtImage: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: "pending-image" }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: "pending-image", isRepresentative: true, sortOrder: 0 }]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({ id: "pending-image" }),
      },
    };
    const prisma = {
      court: { findFirst: vi.fn().mockResolvedValue(publishedCourt()) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    };

    await expect(saveOperatorCourtImages(
      prisma as never,
      { id: "operator-id" },
      "court-id",
      { imageIds: ["pending-image"], representativeImageId: "pending-image" },
      new Date("2030-01-02T00:00:00.000Z"),
    )).resolves.toEqual({ items: [{ id: "pending-image", url: "/api/v1/operator/courts/court-id/images/pending-image", isRepresentative: true, sortOrder: 0 }] });

    expect(transaction.court.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "court-id", status: "ACTIVE", operatorApplication: { applicantUserId: "operator-id", status: "PUBLISH_APPROVED" } },
    }));
    expect(transaction.courtImage.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "pending-image" },
      data: expect.objectContaining({ status: "ATTACHED", isRepresentative: true, sortOrder: 0 }),
    }));
  });

  it("rejects a competing save after the court no longer has publish approval", async () => {
    const transaction = {
      court: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      courtImage: {},
    };
    const prisma = {
      court: { findFirst: vi.fn().mockResolvedValue(publishedCourt()) },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    };

    await expect(saveOperatorCourtImages(prisma as never, { id: "operator-id" }, "court-id", {
      imageIds: ["pending-image"], representativeImageId: "pending-image",
    })).rejects.toMatchObject({ code: "OPERATOR_PUBLISH_APPROVAL_REQUIRED", status: 403 });
  });

  it("only returns a representative photo belonging to a publicly supplied approved court", async () => {
    const findFirst = vi.fn().mockResolvedValue({ privateObjectRef: "https://blob.example/private/court.jpg" });

    await expect(getPublicCourtImageObjectRef({ courtImage: { findFirst } } as never, "court-id")).resolves.toBe("https://blob.example/private/court.jpg");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "ATTACHED",
        isRepresentative: true,
        court: expect.objectContaining({ units: { some: { slots: { some: { visibility: "PUBLIC" } } } } }),
      }),
    }));
  });

  it("claims expired or removed photo metadata before deleting private objects", async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    const prisma = {
      courtImage: {
        findMany: vi.fn().mockResolvedValue([{ id: "image-id", privateObjectRef: "https://blob.example/private/court.jpg", status: "PENDING", createdAt: new Date("2030-01-01T00:00:00.000Z"), expiresAt: null }]),
        updateMany,
      },
    };
    del.mockResolvedValue(undefined);

    await expect(cleanupOperatorCourtImages(prisma as never, new Date("2030-01-03T00:00:00.000Z"))).resolves.toEqual({ checked: 1, deleted: 1, failed: 0 });
    expect(updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ id: "image-id", status: "PENDING" }),
      data: expect.objectContaining({ status: "CLEANUP_PENDING" }),
    }));
    expect(del).toHaveBeenCalledWith("https://blob.example/private/court.jpg");
  });
});
