import { M3MatchDetail } from "@/features/matches/m3-match-detail";

export default function MatchDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  return <M3MatchDetail params={params} />;
}
