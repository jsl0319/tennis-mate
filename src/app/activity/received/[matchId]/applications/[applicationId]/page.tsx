import { M6ApplicantReview } from "@/features/applications/m6-received-applications";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function ApplicantReviewPage({ params }: { params: Promise<{ matchId: string; applicationId: string }> }) {
  const { matchId, applicationId } = await params;
  await requireOnboardedPage(`/activity/received/${encodeURIComponent(matchId)}/applications/${encodeURIComponent(applicationId)}`);
  return <M6ApplicantReview params={params} />;
}
