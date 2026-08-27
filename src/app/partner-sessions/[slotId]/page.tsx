import { PartnerSessionDetail } from "@/features/partner/partner-session-detail";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function PartnerSessionDetailPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;
  await requireOnboardedPage(`/partner-sessions/${encodeURIComponent(slotId)}`);
  return <PartnerSessionDetail slotId={slotId} />;
}
