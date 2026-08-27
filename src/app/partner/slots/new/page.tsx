import { OperatorSlotForm } from "@/features/partner/operator-time-management";
import { requireActivePage } from "@/server/auth/require-onboarded-page";

export default async function PartnerSlotNewPage() {
  await requireActivePage("/partner/slots/new");
  return <OperatorSlotForm />;
}
