import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import { matchChatMessageInputSchema, matchChatReportInputSchema } from "./match-chat";
import { getMatchConversation, makeConversationReadOnly, reportMatchChatMessage, sendMatchChatMessage } from "./match-chat-service";

const matchId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";
const messageId = "30000000-0000-4000-8000-000000000001";
const clientRequestId = "40000000-0000-4000-8000-000000000001";

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

describe("Match Chat input and membership guards", () => {
  it("requires a non-empty, bounded text message and an idempotency key", () => {
    expect(matchChatMessageInputSchema.parse({ body: "  안녕하세요!  ", clientRequestId }).body).toBe("안녕하세요!");
    expect(() => matchChatMessageInputSchema.parse({ body: "", clientRequestId })).toThrow("메시지를 입력");
    expect(() => matchChatMessageInputSchema.parse({ body: "가".repeat(501), clientRequestId })).toThrow("500자");
    expect(() => matchChatMessageInputSchema.parse({ body: "안녕하세요" })).toThrow("요청 식별자");
    expect(() => matchChatReportInputSchema.parse({ reason: "OTHER", description: "가".repeat(201) })).toThrow("200자");
  });

  it("does not reveal a conversation to a pending participant or third party", async () => {
    const prisma = { matchConversation: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as Parameters<typeof getMatchConversation>[0];
    await expect(getMatchConversation(prisma, userId, matchId)).rejects.toMatchObject({ code: "MATCH_CONVERSATION_NOT_FOUND", status: 404 });
  });

  it("does not reopen an archived conversation through a direct URL", async () => {
    const archived = { ...conversationFixture(), status: "ARCHIVED" as const };
    const prisma = { matchConversation: { findFirst: vi.fn().mockResolvedValue(archived) } } as unknown as Parameters<typeof getMatchConversation>[0];
    await expect(getMatchConversation(prisma, userId, matchId)).rejects.toMatchObject({ code: "MATCH_CONVERSATION_NOT_FOUND", status: 404 });
  });

  it("allows reports only for another member's normal message", async () => {
    const transaction = {
      matchConversation: { findFirst: vi.fn().mockResolvedValue(conversationFixture()) },
      matchChatMessage: { findFirst: vi.fn().mockResolvedValue({ id: messageId, senderUserId: userId, type: "USER" }), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as unknown as Parameters<typeof reportMatchChatMessage>[0];
    await expect(reportMatchChatMessage(prisma, userId, matchId, messageId, { reason: "HARASSMENT" })).rejects.toMatchObject({ code: "CHAT_REPORT_NOT_ALLOWED", status: 422 });
    expect(transaction.matchChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Match Chat idempotency and state transitions", () => {
  it("returns the existing message when the same client request is retried", async () => {
    const existing = { id: messageId, conversationId: "conversation-id", senderUserId: userId, type: "USER" as const, body: "준비물은 테니스화예요", visibility: "VISIBLE" as const, clientRequestId, createdAt: new Date("2030-01-01T00:00:00.000Z"), sender: { id: userId, nickname: "테스트참가자" } };
    const transaction = {
      matchConversation: { findFirst: vi.fn().mockResolvedValue(conversationFixture()) },
      matchChatMessage: { findUnique: vi.fn().mockResolvedValue(existing), count: vi.fn(), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as unknown as Parameters<typeof sendMatchChatMessage>[0];
    await expect(sendMatchChatMessage(prisma, userId, matchId, { body: existing.body, clientRequestId })).resolves.toMatchObject({ created: false, message: { id: messageId, isMine: true } });
    expect(transaction.matchChatMessage.create).not.toHaveBeenCalled();
  });

  it("folds a concurrent unique-key conflict back into the single saved message", async () => {
    const saved = { id: messageId, conversationId: "conversation-id", senderUserId: userId, type: "USER" as const, body: "코트 앞에서 만나요", visibility: "VISIBLE" as const, clientRequestId, createdAt: new Date("2030-01-01T00:00:00.000Z"), sender: { id: userId, nickname: "테스트참가자" } };
    const transaction = {
      matchConversation: { findFirst: vi.fn().mockResolvedValue(conversationFixture()) },
      matchChatMessage: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
      matchChatMessage: { findUnique: vi.fn().mockResolvedValue(saved) },
    } as unknown as Parameters<typeof sendMatchChatMessage>[0];
    await expect(sendMatchChatMessage(prisma, userId, matchId, { body: saved.body, clientRequestId })).resolves.toMatchObject({ created: false, message: { id: messageId } });
  });

  it("blocks a sender that exceeds the room-level message limit", async () => {
    const transaction = {
      matchConversation: { findFirst: vi.fn().mockResolvedValue(conversationFixture()) },
      matchChatMessage: { findUnique: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(15), create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as unknown as Parameters<typeof sendMatchChatMessage>[0];
    await expect(sendMatchChatMessage(prisma, userId, matchId, { body: "메시지", clientRequestId })).rejects.toMatchObject({ code: "CHAT_MESSAGE_RATE_LIMITED", status: 429 });
    expect(transaction.matchChatMessage.create).not.toHaveBeenCalled();
  });

  it("turns a room read-only before accepting a message more than 24 hours after play ends", async () => {
    const expiredConversation = conversationFixture();
    expiredConversation.match.endsAt = new Date("2020-01-01T00:00:00.000Z");
    const transaction = {
      matchConversation: {
        findFirst: vi.fn().mockResolvedValue(expiredConversation),
        findUnique: vi.fn().mockResolvedValue({ id: "conversation-id", status: "OPEN" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      matchChatMessage: { create: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as unknown as Parameters<typeof sendMatchChatMessage>[0];

    await expect(sendMatchChatMessage(prisma, userId, matchId, { body: "메시지", clientRequestId })).rejects.toMatchObject({ code: "MATCH_CONVERSATION_NOT_OPEN", status: 409 });
    expect(transaction.matchConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READ_ONLY" }) }));
    expect(transaction.matchChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "SYSTEM" }) }));
  });

  it("makes an open room read-only and records one safe system notice", async () => {
    const transaction = {
      matchConversation: { findUnique: vi.fn().mockResolvedValue({ id: "conversation-id", status: "OPEN" }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      matchChatMessage: { create: vi.fn().mockResolvedValue({ id: messageId }) },
    } as unknown as Parameters<typeof makeConversationReadOnly>[0];
    await expect(makeConversationReadOnly(transaction, matchId, "매칭이 취소되어 이 채팅방은 읽기 전용이에요.")).resolves.toBe(true);
    expect(transaction.matchChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "SYSTEM" }) }));
  });
});
