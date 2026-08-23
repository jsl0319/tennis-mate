import { M6ReceivedMatch } from "@/features/applications/m6-received-applications";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function ReceivedMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  await requireOnboardedPage(`/activity/received/${encodeURIComponent(matchId)}`);
  return <M6ReceivedMatch params={params} />;
}
