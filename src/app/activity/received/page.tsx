import { M6ReceivedApplications } from "@/features/applications/m6-received-applications";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function ReceivedApplicationsPage() {
  await requireOnboardedPage("/activity/received");
  return <M6ReceivedApplications />;
}
