import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";

import { getPrisma } from "@/server/db/prisma";

function fallbackNickname(providerAccountId: string) {
  return `테니스${providerAccountId.slice(-6)}`.slice(0, 12);
}

function initialNickname(profile: Record<string, unknown>, providerAccountId: string) {
  const candidate = typeof profile.properties === "object" && profile.properties
    ? (profile.properties as { nickname?: unknown }).nickname
    : profile.nickname;
  const normalized = typeof candidate === "string"
    ? candidate.replace(/[^가-힣a-zA-Z0-9]/g, "").slice(0, 12)
    : "";

  return normalized.length >= 2 ? normalized : fallbackNickname(providerAccountId);
}

async function uniqueInitialNickname(base: string) {
  const prisma = getPrisma();
  let suffix = 0;
  let candidate = base;

  while (await prisma.user.findUnique({ where: { nickname: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base.slice(0, 12 - String(suffix).length)}${suffix}`;
  }

  return candidate;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Kakao],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "kakao" || !account.providerAccountId || !profile) return false;

      const prisma = getPrisma();
      const existingAccount = await prisma.authAccount.findUnique({
        where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
      });
      if (existingAccount) return true;

      await prisma.user.create({
        data: {
          nickname: await uniqueInitialNickname(initialNickname(profile as Record<string, unknown>, account.providerAccountId)),
          authAccounts: { create: { provider: account.provider, providerAccountId: account.providerAccountId } },
        },
      });
      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider && account.providerAccountId) {
        const linkedAccount = await getPrisma().authAccount.findUnique({
          where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } },
          select: { userId: true },
        });
        token.userId = linkedAccount?.userId;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
});
