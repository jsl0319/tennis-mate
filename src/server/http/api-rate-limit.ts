export const API_RATE_LIMIT_MAX_REQUESTS = 120;
export const API_RATE_LIMIT_WINDOW_MS = 60_000;

export class ApiRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("요청이 많아요. 잠시 후 다시 시도해 주세요.");
  }
}

export function getApiRateLimitWindowStartedAt(now: Date) {
  return new Date(Math.floor(now.getTime() / API_RATE_LIMIT_WINDOW_MS) * API_RATE_LIMIT_WINDOW_MS);
}

export function getApiRateLimitRetryAfterSeconds(now: Date, windowStartedAt: Date) {
  const nextWindowAt = windowStartedAt.getTime() + API_RATE_LIMIT_WINDOW_MS;
  return Math.max(1, Math.ceil((nextWindowAt - now.getTime()) / 1000));
}
