import { M6ApplicantReview } from "@/features/applications/m6-received-applications";

export default function ApplicantReviewPage({ params }: { params: Promise<{ matchId: string; applicationId: string }> }) {
  return <M6ApplicantReview params={params} />;
}
