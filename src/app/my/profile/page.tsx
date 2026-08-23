import { ProfileEditPage } from "@/features/profile/profile-edit-page";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function MyProfilePage() {
  await requireOnboardedPage("/my/profile");
  return <ProfileEditPage />;
}
