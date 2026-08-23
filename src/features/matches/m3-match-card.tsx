import Link from "next/link";

export type MatchCardData = {
  id: string;
  title: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string;
  region: { name: string };
  court: { sourceLabel: string; name: string | null };
  playPurposes: Array<{ code: string; label: string }>;
  beginnerWelcome: boolean;
  remainingSpots: number;
  estimatedFeePerPersonKrw: number | null;
  recommendationReasons: Array<{ code: string; label: string }>;
};

function formatSchedule(startsAt: string, endsAt: string) {
  const date = new Date(startsAt);
  const end = new Date(endsAt);
  const day = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(date);
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" });
  return `${day} · ${time.format(date)}–${time.format(end)}`;
}

export function MatchCard({ match, returnTo = "/" }: { match: MatchCardData; returnTo?: string }) {
  return (
    <Link
      className="flex min-h-72 w-full flex-col rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm transition hover:border-[#79b99a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f7a55]"
      href={`/matches/${match.id}?returnTo=${encodeURIComponent(returnTo)}`}
    >
      <div className="flex min-h-7 flex-wrap content-start gap-2 text-xs font-semibold">
        <span className="rounded-full bg-[#eff9f4] px-2.5 py-1 text-[#1f7a55]">{match.statusLabel}</span>
        {match.beginnerWelcome ? <span className="rounded-full bg-[#f6f4e9] px-2.5 py-1 text-[#6c5a18]">🌱 초보자 환영</span> : null}
      </div>
      <h2 className="mt-3 line-clamp-2 min-h-14 text-lg font-bold leading-7">{match.title}</h2>
      <p className="mt-2 min-h-5 truncate text-sm font-medium text-[#1f7a55]">
        {match.recommendationReasons[0]?.label ?? <span aria-hidden>&nbsp;</span>}
      </p>
      <dl className="mt-4 grid gap-2 text-sm leading-5 text-[#405047]">
        <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-2"><dt aria-hidden>🗓</dt><dd className="truncate">{formatSchedule(match.startsAt, match.endsAt)}</dd></div>
        <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-2"><dt aria-hidden>📍</dt><dd className="truncate">{match.region.name} · {match.court.name ?? "코트는 함께 정해요"}</dd></div>
        <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-2"><dt aria-hidden>👥</dt><dd className="truncate">남은 자리 {match.remainingSpots}명 · {match.estimatedFeePerPersonKrw === null ? "비용 협의 필요" : `1인 약 ${match.estimatedFeePerPersonKrw.toLocaleString("ko-KR")}원`}</dd></div>
      </dl>
      <p className="mt-auto border-t border-[#edf1ee] pt-3 text-xs leading-5 text-[#5c6b63]">{match.court.sourceLabel}</p>
    </Link>
  );
}

export function MatchCardSkeleton() {
  return <div className="h-72 animate-pulse rounded-3xl bg-[#eaf0ec]" />;
}
