import { PartnerSessionList } from "@/features/partner/partner-session-list";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function PartnerSessionsPage() {
  await requireOnboardedPage("/partner-sessions");
  return <PartnerSessionList />;
}
