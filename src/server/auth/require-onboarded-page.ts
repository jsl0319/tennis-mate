import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOnboardingPath, getLoginPath } from "@/navigation/return-to";
import { getPrisma } from "@/server/db/prisma";

/**
 * Keeps protected page entry points aligned with the API authorization rules.
 * APIs remain the final authority; this only prevents a visitor from seeing a
 * misleading retry state before being sent through login and onboarding.
 */
export async function requireOnboardedPage(returnTo: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect(getLoginPath(returnTo));

  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { onboardingCompletedAt: true },
  });

  if (!user?.onboardingCompletedAt) redirect(getOnboardingPath(returnTo));
}

/** Operator registration is available before the tennis-profile onboarding. */
export async function requireActivePage(returnTo: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect(getLoginPath(returnTo));

  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status !== "ACTIVE") redirect(getLoginPath(returnTo));
}

/** Internal review pages use a role stored in the database, never a client-supplied flag. */
export async function requireInternalReviewerPage(returnTo: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect(getLoginPath(returnTo));

  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { status: true, role: true },
  });
  if (!user || user.status !== "ACTIVE") redirect(getLoginPath(returnTo));
  if (user.role !== "INTERNAL_REVIEWER") redirect("/");
}
