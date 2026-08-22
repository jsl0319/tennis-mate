import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import { API_RATE_LIMIT_MAX_REQUESTS, ApiRateLimitError, getApiRateLimitRetryAfterSeconds, getApiRateLimitWindowStartedAt } from "@/server/http/api-rate-limit";

export async function enforceApiRateLimit(prisma: PrismaClient, userId: string, now = new Date()) {
  const windowStartedAt = getApiRateLimitWindowStartedAt(now);
  const incremented = await prisma.apiRateLimit.updateMany({
    where: {
      userId,
      windowStartedAt,
      requestCount: { lt: API_RATE_LIMIT_MAX_REQUESTS },
    },
    data: { requestCount: { increment: 1 } },
  });

  if (incremented.count === 1) return;

  const reset = await prisma.apiRateLimit.updateMany({
    where: { userId, windowStartedAt: { lt: windowStartedAt } },
    data: { windowStartedAt, requestCount: 1 },
  });

  if (reset.count === 1) return;

  try {
    await prisma.apiRateLimit.create({ data: { userId, windowStartedAt, requestCount: 1 } });
    return;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
  }

  const retriedIncrement = await prisma.apiRateLimit.updateMany({
    where: {
      userId,
      windowStartedAt,
      requestCount: { lt: API_RATE_LIMIT_MAX_REQUESTS },
    },
    data: { requestCount: { increment: 1 } },
  });

  if (retriedIncrement.count === 1) return;

  throw new ApiRateLimitError(getApiRateLimitRetryAfterSeconds(now, windowStartedAt));
}
