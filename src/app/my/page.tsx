import { M8MyPage } from "@/features/profile/m8-my-page";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function MyPage() {
  await requireOnboardedPage("/my");
  return <M8MyPage />;
}
