"use client";

import { useRouter } from "next/navigation";

import { getSafeReturnTo, isOperatorApplicationReturnTo } from "@/navigation/return-to";

import { M2OnboardingFlow } from "./m2-onboarding-flow";

export function LoginPage({ returnTo = "/" }: { returnTo?: string }) {
  const router = useRouter();
  const safeReturnTo = getSafeReturnTo(returnTo);

  return <M2OnboardingFlow redirectWhenOnboarded returnTo={safeReturnTo} skipTennisProfileOnboarding={isOperatorApplicationReturnTo(safeReturnTo)} onCompleted={() => router.replace(safeReturnTo)} />;
}
