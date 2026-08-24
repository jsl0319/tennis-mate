import { OperatorApplicationFlow } from "@/features/partner/operator-application-flow";
import { requireActivePage } from "@/server/auth/require-onboarded-page";

export default async function PartnerApplicationPage() {
  await requireActivePage("/partner/apply");
  return <OperatorApplicationFlow />;
}
