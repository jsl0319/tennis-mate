import { OperatorSlotList } from "@/features/partner/operator-time-management";
import { requireActivePage } from "@/server/auth/require-onboarded-page";

export default async function PartnerSlotsPage() {
  await requireActivePage("/partner/slots");
  return <OperatorSlotList />;
}
