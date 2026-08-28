import { OperatorCourtPhotoManagement } from "@/features/partner/operator-court-photo-management";
import { requireActivePage } from "@/server/auth/require-onboarded-page";

export default async function PartnerCourtPhotosPage() {
  await requireActivePage("/partner/court-photos");
  return <OperatorCourtPhotoManagement />;
}
