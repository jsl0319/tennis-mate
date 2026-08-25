import { z } from "zod";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const courtCreateInputSchema = z.object({
  regionCode: z.string().trim().min(1, "시설이 있는 시·군·구를 선택해 주세요."),
});

export type CourtCreateInput = z.infer<typeof courtCreateInputSchema>;

export const courtSlotCreateInputSchema = z.object({
  courtUnitName: z.string().trim().min(1, "코트 면 이름을 입력해 주세요.").max(50, "코트 면 이름은 50자 이하여야 해요."),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  priceKrw: z.number().int().min(0, "코트 전체 비용은 0원 이상이어야 해요."),
  maxParticipantCount: z.number().int().min(2, "현장 최대 인원은 2명 이상이어야 해요."),
  usageNote: z.string().trim().max(500, "이용 안내는 500자 이하여야 해요.").nullable().optional(),
}).superRefine((input, context) => {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);

  if (startsAt <= new Date()) {
    context.addIssue({ code: "custom", path: ["startsAt"], message: "시작 시간은 현재보다 미래여야 해요." });
  }
  if (startsAt >= endsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "종료 시간은 시작 시간보다 늦어야 해요." });
  }
});

export type CourtSlotCreateInput = z.infer<typeof courtSlotCreateInputSchema>;

export const courtSlotIdSchema = z.string().uuid("코트 시간 정보를 다시 선택해 주세요.");

