import { M4MatchCreate } from "@/features/matches/m4-match-create";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function NewMatchPage() {
  await requireOnboardedPage("/matches/new");
  return <M4MatchCreate />;
}
