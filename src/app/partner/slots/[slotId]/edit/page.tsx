import { OperatorSlotForm } from "@/features/partner/operator-time-management";
import { requireActivePage } from "@/server/auth/require-onboarded-page";

export default async function PartnerSlotEditPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;
  await requireActivePage(`/partner/slots/${encodeURIComponent(slotId)}/edit`);
  return <OperatorSlotForm slotId={slotId} />;
}
