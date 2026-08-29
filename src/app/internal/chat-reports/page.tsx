import { InternalMatchChatReportReview } from "@/features/internal/match-chat-report-review";
import { requireInternalReviewerPage } from "@/server/auth/require-onboarded-page";

export default async function InternalChatReportsPage() {
  await requireInternalReviewerPage("/internal/chat-reports");
  return <InternalMatchChatReportReview />;
}
