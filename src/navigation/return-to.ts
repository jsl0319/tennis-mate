const localOrigin = "https://tennis-mate.local";

export function getSafeReturnTo(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /%2f|%5c/i.test(value)) {
    return fallback;
  }

  try {
    const url = new URL(value, localOrigin);
    if (url.origin !== localOrigin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getLoginPath(returnTo: string | null | undefined) {
  const safeReturnTo = getSafeReturnTo(returnTo);
  return safeReturnTo === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function getOnboardingPath(returnTo: string) {
  const safeReturnTo = getSafeReturnTo(returnTo);
  return safeReturnTo === "/" ? "/" : `/?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
