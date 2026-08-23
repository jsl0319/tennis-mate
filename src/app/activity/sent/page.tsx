import { M5SentApplications } from "@/features/applications/m5-sent-applications";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function SentApplicationsPage() {
  await requireOnboardedPage("/activity/sent");
  return <M5SentApplications />;
}
