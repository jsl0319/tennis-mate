import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

import { requireE2eDatabaseUrl } from "./e2e-environment";

export const e2eUsers = {
  host: { id: "20000000-0000-4000-8000-000000000001", nickname: "E2E모집자" },
  applicant: { id: "20000000-0000-4000-8000-000000000002", nickname: "E2E참가자" },
  outsider: { id: "20000000-0000-4000-8000-000000000003", nickname: "E2E외부인" },
} as const;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireE2eDatabaseUrl() }) });

export type E2eFixture = { matchTitle: string };

async function createOnboardedUser({ id, nickname }: { id: string; nickname: string }) {
  return prisma.user.create({
    data: {
      id,
      nickname,
      nicknameConfirmedAt: new Date(),
      onboardingCompletedAt: new Date(),
      tennisProfile: {
        create: {
          experienceRange: "MONTHS_6_TO_12",
          rallyLevel: "SHORT_RALLY",
          gameExperience: "KNOWS_RULES",
          regions: { create: { regionCode: "E2E-SEOUL-001", isPrimary: true } },
          purposes: { create: { purpose: "RALLY_PRACTICE" } },
        },
      },
    },
  });
}

export async function resetE2eDatabase(): Promise<E2eFixture> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users", "regions" RESTART IDENTITY CASCADE');

  await prisma.region.create({ data: { code: "E2E-SEOUL", name: "E2E 서울", shortName: "E2E서울", type: "CITY", active: true } });
  await prisma.region.create({ data: { code: "E2E-SEOUL-001", name: "E2E 마포구", parentCode: "E2E-SEOUL", type: "DISTRICT", active: true } });

  await createOnboardedUser(e2eUsers.host);
  await createOnboardedUser(e2eUsers.applicant);
  await createOnboardedUser(e2eUsers.outsider);

  const matchTitle = "E2E 주말 랠리 연습";
  return { matchTitle };
}

export async function disconnectE2eDatabase() {
  await prisma.$disconnect();
}
