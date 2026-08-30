import { describe, expect, it, vi } from "vitest";

const { del, get, put } = vi.hoisted(() => ({ del: vi.fn(), get: vi.fn(), put: vi.fn() }));

vi.mock("@vercel/blob", () => ({ del, get, put }));

import {
  cleanupPendingMatchChatImageUploads,
  createMatchChatImageUpload,
  getMatchChatImageObjectRefForMember,
} from "./match-chat-image-service";

const matchId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";

function conversationFixture() {
  return {
    id: "conversation-id",
    matchId,
    status: "OPEN" as const,
    readOnlyAt: null,
    archiveAt: null,
    createdAt: new Date("2030-01-01T00:00:00.000Z"),
    updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    match: { id: matchId, title: "편하게 랠리해요", startsAt: new Date("2030-01-02T01:00:00.000Z"), endsAt: new Date("2030-01-02T03:00:00.000Z"), status: "OPEN" as const, hostUserId: "host-user-id" },
    members: [{ id: "member-id", conversationId: "conversation-id", userId, role: "PARTICIPANT" as const, joinedAt: new Date(), sendingSuspendedAt: null, lastReadMessageId: null, updatedAt: new Date(), user: { nickname: "테스트참가자" } }],
  };
}

describe("Match Chat image uploads", () => {
  it("rejects a disguised image before object storage is called", async () => {
    put.mockReset();
    const file = new File([new Uint8Array([0x00, 0x01, 0x02])], "not-an-image.jpg", { type: "image/jpeg" });
    await expect(createMatchChatImageUpload({} as never, userId, matchId, file)).rejects.toMatchObject({ code: "CHAT_IMAGE_SIGNATURE_INVALID", status: 422 });
    expect(put).not.toHaveBeenCalled();
  });

  it("stores a validated image only for an open, sending-capable room member", async () => {
    put.mockReset();
    put.mockResolvedValue({ url: "https://blob.example/private/chat.jpg" });
    const transaction = {
      matchConversation: { findFirst: vi.fn().mockResolvedValue(conversationFixture()) },
      matchChatImageUpload: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: "50000000-0000-4000-8000-000000000001" }) },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as never;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "court.jpg", { type: "image/jpeg" });

    await expect(createMatchChatImageUpload(prisma, userId, matchId, file)).resolves.toEqual({ id: "50000000-0000-4000-8000-000000000001" });
    expect(put).toHaveBeenCalledWith(expect.stringContaining("match-chat-images/conversation-id/"), expect.any(Buffer), expect.objectContaining({ access: "private", contentType: "image/jpeg" }));
    expect(transaction.matchChatImageUpload.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ conversationId: "conversation-id", ownerUserId: userId, privateObjectRef: "https://blob.example/private/chat.jpg" }),
    }));
  });

  it("does not reveal a photo object reference to a user outside the room", async () => {
    const imageLookup = vi.fn();
    const prisma = { matchConversation: { findFirst: vi.fn().mockResolvedValue(null) }, matchChatImageUpload: { findFirst: imageLookup } } as never;
    await expect(getMatchChatImageObjectRefForMember(prisma, "other-user-id", matchId, "30000000-0000-4000-8000-000000000001", "50000000-0000-4000-8000-000000000001")).rejects.toMatchObject({ code: "MATCH_CONVERSATION_NOT_FOUND", status: 404 });
    expect(imageLookup).not.toHaveBeenCalled();
  });

  it("claims an expired pending upload before deleting its private object", async () => {
    del.mockReset();
    del.mockResolvedValue(undefined);
    const now = new Date("2030-01-03T00:00:00.000Z");
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    const prisma = {
      matchChatImageUpload: {
        findMany: vi.fn().mockResolvedValue([{ id: "50000000-0000-4000-8000-000000000001", privateObjectRef: "https://blob.example/private/chat.jpg" }]),
        updateMany,
      },
    } as never;

    await expect(cleanupPendingMatchChatImageUploads(prisma, now)).resolves.toEqual({ checked: 1, deleted: 1, failed: 0 });
    expect(updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ status: "CLEANUP_PENDING" }) }));
    expect(del).toHaveBeenCalledWith("https://blob.example/private/chat.jpg");
    expect(updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ status: "DELETED" }) }));
  });
});
