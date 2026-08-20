import { M6ReceivedMatch } from "@/features/applications/m6-received-applications";

export default function ReceivedMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  return <M6ReceivedMatch params={params} />;
}
