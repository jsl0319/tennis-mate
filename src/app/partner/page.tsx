import { OperatorDashboard } from "@/features/partner/operator-time-management";
import { requireActivePage } from "@/server/auth/require-onboarded-page";

export default async function PartnerHomePage() {
  await requireActivePage("/partner");
  return <OperatorDashboard />;
}
