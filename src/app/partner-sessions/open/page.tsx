import { PartnerSessionCreate } from "@/features/partner/partner-session-create";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function OpenPartnerSessionPage({ searchParams }: { searchParams: Promise<{ slotId?: string }> }) {
  const { slotId = "" } = await searchParams;
  await requireOnboardedPage(`/partner-sessions/open${slotId ? `?slotId=${encodeURIComponent(slotId)}` : ""}`);
  return <PartnerSessionCreate slotId={slotId} />;
}
