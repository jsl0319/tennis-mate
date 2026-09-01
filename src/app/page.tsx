import { RallyOnHome } from "@/features/matches/m3-home";
import { getSafeReturnTo } from "@/navigation/return-to";

export default async function Home({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { returnTo } = await searchParams;
  return <RallyOnHome returnTo={getSafeReturnTo(typeof returnTo === "string" ? returnTo : null)} />;
}
