import Link from "next/link";

import { CourtMedia, type CourtImageView } from "./court-media";

export type MatchCardData = {
  id: string;
  title: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string;
  region: { name: string };
  court: { sourceLabel: string; name: string | null; image: CourtImageView };
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
      className="flex min-h-[218px] w-full gap-4 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5 shadow-sm transition hover:border-[var(--tm-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-action-primary)]"
      href={`/matches/${match.id}?returnTo=${encodeURIComponent(returnTo)}`}
    >
      <CourtMedia alt={match.court.name ? `${match.court.name} 코트 사진` : "코트 정보"} className="h-[178px] w-28 shrink-0" fallbackLabel={match.court.name ? "코트 사진 없음" : "코트 미정"} image={match.court.image} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-5 items-center gap-1 overflow-hidden text-[11px] font-semibold leading-4">
          <span className="shrink-0 text-[var(--tm-action-primary)]">{match.statusLabel}</span>
          {match.beginnerWelcome ? <span className="truncate text-[var(--tm-tennis-ball-muted)]">· 🌱 초보자 환영</span> : null}
        </div>
        <h2 className="line-clamp-2 min-h-[52px] text-lg font-medium leading-[26px]">{match.title}</h2>
        <p className="min-h-5 truncate text-sm leading-5 text-[var(--tm-action-primary)]">
          {match.recommendationReasons[0]?.label ?? <span aria-hidden>&nbsp;</span>}
        </p>
        <p className="text-sm leading-5 text-[var(--tm-text-secondary)]">
          {formatSchedule(match.startsAt, match.endsAt)}<br />
          {match.region.name} · {match.court.name ?? "코트는 함께 정해요"}<br />
          <span className="text-[var(--tm-text-secondary)]">{match.court.sourceLabel}</span><br />
          {match.estimatedFeePerPersonKrw === null ? "비용 협의 필요" : `1인 약 ${match.estimatedFeePerPersonKrw.toLocaleString("ko-KR")}원`} · 남은 자리 {match.remainingSpots}명
        </p>
      </div>
    </Link>
  );
}

export function MatchCardSkeleton() {
  return <div className="h-[218px] animate-pulse rounded-3xl bg-[var(--tm-bg-subtle)]" />;
}
