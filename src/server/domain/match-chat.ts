import { z } from "zod";

export const matchChatMatchIdSchema = z.string().uuid("매칭 채팅방을 다시 선택해 주세요.");
export const matchChatMessageIdSchema = z.string().uuid("채팅 메시지를 다시 선택해 주세요.");
export const matchChatImageUploadIdSchema = z.string().uuid("채팅 사진을 다시 선택해 주세요.");

export const matchChatMessageInputSchema = z.object({
  body: z.string().trim().max(500, "메시지는 500자 이하여야 해요.").refine((value) => (value.match(/\n/g)?.length ?? 0) <= 12, "줄바꿈은 12개까지 사용할 수 있어요.").default(""),
  imageUploadIds: z.array(matchChatImageUploadIdSchema).max(3, "사진은 한 번에 3장까지 보낼 수 있어요.").default([]),
  clientRequestId: z.string({ error: "메시지 요청 식별자를 다시 만들어 주세요." }).uuid("메시지 요청 식별자를 다시 만들어 주세요."),
}).superRefine((value, context) => {
  if (!value.body && value.imageUploadIds.length === 0) {
    context.addIssue({ code: "custom", path: ["body"], message: "메시지나 사진을 선택해 주세요." });
  }
  if (new Set(value.imageUploadIds).size !== value.imageUploadIds.length) {
    context.addIssue({ code: "custom", path: ["imageUploadIds"], message: "같은 사진을 여러 번 보낼 수 없어요." });
  }
});

export type MatchChatMessageInput = {
  body: string;
  imageUploadIds?: string[];
  clientRequestId: string;
};

export const matchChatReadInputSchema = z.object({
  messageId: z.string().uuid("마지막 메시지를 다시 확인해 주세요."),
});

export type MatchChatReadInput = z.infer<typeof matchChatReadInputSchema>;

export const matchChatReportInputSchema = z.object({
  reason: z.enum(["HARASSMENT", "SEXUAL_OR_HATEFUL_CONTENT", "PERSONAL_INFORMATION", "SPAM_OR_FRAUD", "OTHER"]),
  description: z.string().trim().max(200, "신고 설명은 200자 이하여야 해요.").nullable().optional(),
});

export type MatchChatReportInput = z.infer<typeof matchChatReportInputSchema>;

export const matchChatListQuerySchema = z.object({
  role: z.enum(["HOST", "PARTICIPANT"]).default("HOST"),
});

export const internalChatReportListQuerySchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]).default("OPEN"),
});

export const matchChatModerationActionInputSchema = z.object({
  action: z.enum(["NO_ACTION", "HIDE_MESSAGE", "SUSPEND_SENDING", "SET_READ_ONLY"]),
  reason: z.string().trim().max(200, "검토 메모는 200자 이하여야 해요.").nullable().optional(),
});

export type MatchChatModerationActionInput = z.infer<typeof matchChatModerationActionInputSchema>;

export const CHAT_MESSAGE_PAGE_SIZE = 30;
export const CHAT_MESSAGE_RATE_LIMIT_PER_MINUTE = 15;
