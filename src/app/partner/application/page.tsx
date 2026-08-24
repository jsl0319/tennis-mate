import { OperatorApplicationStatus } from "@/features/partner/operator-application-status";
import { requireActivePage } from "@/server/auth/require-onboarded-page";

export default async function PartnerApplicationStatusPage() {
  await requireActivePage("/partner/application");
  return <OperatorApplicationStatus />;
}
