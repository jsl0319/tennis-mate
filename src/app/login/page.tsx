import { LoginPage } from "@/features/profile/login-page";
import { getSafeReturnTo } from "@/navigation/return-to";

export default async function Login({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { returnTo } = await searchParams;
  return <LoginPage returnTo={getSafeReturnTo(typeof returnTo === "string" ? returnTo : null)} />;
}
