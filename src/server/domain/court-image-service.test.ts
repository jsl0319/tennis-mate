import { beforeEach, describe, expect, it, vi } from "vitest";

const { del, get, put } = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ del, get, put }));

import {
  cleanupPendingCourtImageUploads,
  createCourtImageUpload,
  getCourtImageObjectRefForViewer,
} from "./court-image-service";

function jpegFile(bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00])) {
  return new File([bytes], "court.jpg", { type: "image/jpeg" });
}

describe("court image service", () => {
  beforeEach(() => {
    del.mockReset();
    get.mockReset();
    put.mockReset();
  });

  it("stores a valid court image privately and returns only its opaque upload id", async () => {
    put.mockResolvedValue({ url: "https://blob.example/private/court.jpg", contentType: "image/jpeg" });
    const create = vi.fn().mockResolvedValue({ id: "upload-id" });
    const prisma = { courtImageUpload: { create } };

    await expect(createCourtImageUpload(prisma as never, "owner-id", jpegFile())).resolves.toEqual({ id: "upload-id" });

    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^court-images\/owner-id\/.+\.jpg$/),
      expect.any(Buffer),
      { access: "private", contentType: "image/jpeg", addRandomSuffix: false },
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerUserId: "owner-id",
        privateObjectRef: "https://blob.example/private/court.jpg",
        contentType: "image/jpeg",
        byteSize: 4,
      }),
      select: { id: true },
    });
  });

  it("rejects a content-type spoof before sending it to object storage", async () => {
    await expect(createCourtImageUpload({ courtImageUpload: {} } as never, "owner-id", new File(["not an image"], "court.svg", { type: "image/svg+xml" }))).rejects.toMatchObject({
      code: "COURT_IMAGE_TYPE_NOT_ALLOWED",
      status: 422,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a JPEG declaration whose bytes are not a JPEG", async () => {
    await expect(createCourtImageUpload({ courtImageUpload: {} } as never, "owner-id", jpegFile(new Uint8Array([0x00, 0x01, 0x02])))).rejects.toMatchObject({
      code: "COURT_IMAGE_SIGNATURE_INVALID",
      status: 422,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("does not reveal a closed match photo to someone outside its history", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      hostUserId: "host-id",
      status: "CLOSED",
      applications: [],
      externalCourtImageUpload: { privateObjectRef: "https://blob.example/private/court.jpg", status: "ATTACHED" },
    });

    await expect(getCourtImageObjectRefForViewer({ match: { findUnique } } as never, { id: "other-user-id" }, "match-id")).rejects.toMatchObject({
      code: "MATCH_NOT_FOUND",
      status: 404,
    });
  });

  it("claims an expired pending upload before deleting the private object", async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    const prisma = {
      courtImageUpload: {
        findMany: vi.fn().mockResolvedValue([{ id: "upload-id", privateObjectRef: "https://blob.example/private/court.jpg" }]),
        updateMany,
      },
    };
    del.mockResolvedValue(undefined);

    await expect(cleanupPendingCourtImageUploads(prisma as never, new Date("2030-01-02T00:00:00.000Z"))).resolves.toEqual({ checked: 1, deleted: 1, failed: 0 });
    expect(updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ id: "upload-id", status: "PENDING" }),
      data: { status: "CLEANUP_PENDING", cleanupClaimedAt: new Date("2030-01-02T00:00:00.000Z") },
    }));
    expect(del).toHaveBeenCalledWith("https://blob.example/private/court.jpg");
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "upload-id", status: "CLEANUP_PENDING" },
      data: { status: "DELETED", deletedAt: new Date("2030-01-02T00:00:00.000Z") },
    });
  });
});
