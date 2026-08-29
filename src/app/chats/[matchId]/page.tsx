import { MatchConversation } from "@/features/chats/match-conversation";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function MatchConversationPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  await requireOnboardedPage(`/chats/${encodeURIComponent(matchId)}`);
  return <MatchConversation params={params} />;
}
