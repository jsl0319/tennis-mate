import { M3MatchDetail } from "@/features/matches/m3-match-detail";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function MatchDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  await requireOnboardedPage(`/matches/${encodeURIComponent(matchId)}`);
  return <M3MatchDetail params={params} />;
}
