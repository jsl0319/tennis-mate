import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRateLimitedCurrentUser, getPrisma, getMatchConversationMessages, sendMatchChatMessage } = vi.hoisted(() => ({
  getRateLimitedCurrentUser: vi.fn(),
  getPrisma: vi.fn(),
  getMatchConversationMessages: vi.fn(),
  sendMatchChatMessage: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getRateLimitedCurrentUser,
  AuthenticationError: class AuthenticationError extends Error {},
  AccountAccessError: class AccountAccessError extends Error {},
}));
vi.mock("@/server/db/prisma", () => ({ getPrisma }));
vi.mock("@/server/domain/match-chat-service", () => ({ getMatchConversationMessages, sendMatchChatMessage }));

import { GET, POST } from "./route";

const matchId = "10000000-0000-4000-8000-000000000001";
const clientRequestId = "40000000-0000-4000-8000-000000000001";

describe("/api/v1/matches/{matchId}/conversation/messages", () => {
  beforeEach(() => {
    getRateLimitedCurrentUser.mockReset();
    getPrisma.mockReset();
    getMatchConversationMessages.mockReset();
    sendMatchChatMessage.mockReset();
  });

  it("uses the authenticated member and keeps message cursors server-side", async () => {
    const prisma = { matchConversation: {} };
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id" });
    getPrisma.mockReturnValue(prisma);
    getMatchConversationMessages.mockResolvedValue({ messages: [], pageInfo: { hasMoreBefore: false, nextBefore: null, nextAfter: null, latestCursor: null } });

    const response = await GET(new Request(`http://localhost/api/v1/matches/${matchId}/conversation/messages?before=cursor-a`), { params: Promise.resolve({ matchId }) });

    expect(response.status).toBe(200);
    expect(getMatchConversationMessages).toHaveBeenCalledWith(prisma, "member-id", matchId, { before: "cursor-a", after: undefined });
  });

  it("validates a chat message before it can be sent", async () => {
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id" });

    const response = await POST(new Request(`http://localhost/api/v1/matches/${matchId}/conversation/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "", clientRequestId }),
    }), { params: Promise.resolve({ matchId }) });

    expect(response.status).toBe(422);
    expect(sendMatchChatMessage).not.toHaveBeenCalled();
  });

  it("uses a single client request id for a retried message", async () => {
    const prisma = { matchConversation: {} };
    getRateLimitedCurrentUser.mockResolvedValue({ id: "member-id" });
    getPrisma.mockReturnValue(prisma);
    sendMatchChatMessage.mockResolvedValue({ created: false, message: { id: "message-id", body: "안녕하세요" } });

    const response = await POST(new Request(`http://localhost/api/v1/matches/${matchId}/conversation/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "안녕하세요", clientRequestId }),
    }), { params: Promise.resolve({ matchId }) });

    expect(response.status).toBe(200);
    expect(sendMatchChatMessage).toHaveBeenCalledWith(prisma, "member-id", matchId, { body: "안녕하세요", clientRequestId });
  });
});
