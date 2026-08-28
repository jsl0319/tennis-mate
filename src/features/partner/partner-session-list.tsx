"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { CourtMedia } from "@/features/matches/court-media";

import { apiMessage, formatPartnerSchedule, formatStatusChangedAt, type PublicCourtSlot } from "./partner-session";

type SlotListResponse = { items: PublicCourtSlot[] };

export function PartnerSessionList() {
  const [slots, setSlots] = useState<PublicCourtSlot[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/v1/partner-session-slots", { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "제휴 코트 시간을 불러오지 못했어요."));
      setSlots((body as SlotListResponse).items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "제휴 코트 시간을 불러오지 못했어요.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!slots && !error) return <main className="grid min-h-svh place-items-center bg-[var(--tm-bg-page)] px-5"><CourtRallyLoader className="max-w-[560px]" label="제휴 코트 시간을 준비하고 있어요." /></main>;

  return <main className="min-h-svh bg-[var(--tm-bg-page)] pb-28 text-[var(--tm-text-primary)]">
    <header className="border-b border-[var(--tm-border-default)] bg-[var(--tm-bg-page)]">
      <div className="mx-auto max-w-[560px] px-5 pb-5 pt-8">
        <p className="text-sm font-semibold text-[var(--tm-action-primary)]">Tennis Mate 제휴 코트</p>
        <h1 className="mt-2 text-2xl font-bold leading-snug">코트 걱정 없이<br />함께 테니스해요</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--tm-text-secondary)]">운영자가 준비한 코트 시간에 나와 비슷한 메이트와 함께해요.</p>
      </div>
    </header>
    <section className="mx-auto max-w-[560px] px-5 pt-6">
      <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold">이번 주 제휴 코트 세션</h2><p className="mt-1 text-sm text-[var(--tm-text-secondary)]">참가 신청은 세션을 연 모집자에게 보내요.</p></div></div>
      {error ? <div className="mt-5 rounded-3xl bg-[var(--tm-status-error-bg)] p-5"><p className="font-semibold text-[var(--tm-status-error-text)]">불러오지 못했어요</p><p className="mt-2 text-sm leading-6 text-[var(--tm-status-error-text)]">{error}</p><button className="mt-4 min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-[var(--tm-action-primary)]" onClick={() => void load()} type="button">다시 불러오기</button></div> : null}
      {!error && slots?.length === 0 ? <EmptyState /> : null}
      {!error && slots && slots.length > 0 ? <div className="mt-5 grid gap-4">{slots.map((slot) => <PublicSlotCard key={slot.id} slot={slot} />)}</div> : null}
    </section>
    <BottomNavigation />
  </main>;
}

function PublicSlotCard({ slot }: { slot: PublicCourtSlot }) {
  const isCancelledSession = slot.session?.status === "CANCELLED";
  const stateText = slot.availableAction === "OPEN_SESSION"
    ? "세션을 열 수 있어요"
    : slot.availableAction === "VIEW_SESSION"
      ? isCancelledSession ? "세션이 취소됐어요" : "세션 모집 중"
      : "새 세션 연결이 중지됐어요";

  return <article className="overflow-hidden rounded-3xl border border-[var(--tm-border-default)] bg-white shadow-sm">
    <Link className="block p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-action-primary)]" href={`/partner-sessions/${slot.id}`}>
      <CourtMedia alt={`${slot.court.name} 코트 이미지`} className="aspect-[7/3] w-full" fallbackLabel="Tennis Mate 기본 코트 이미지" image={slot.court.image} />
      <div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--tm-bg-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--tm-action-primary)]">Tennis Mate 제휴 코트</span><span className="text-xs font-semibold text-[var(--tm-text-secondary)]">{slot.statusLabel}</span></div>
      <h3 className="mt-3 text-lg font-bold">{stateText}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">🗓 {formatPartnerSchedule(slot.startsAt, slot.endsAt)}<br />📍 {slot.court.name} · {slot.court.courtNumber}<br />💳 전체 {slot.totalCourtFeeKrw.toLocaleString("ko-KR")}원 · 현장 최대 {slot.maxParticipantCount}명</p>
      {slot.usageNote ? <p className="mt-3 rounded-2xl bg-[var(--tm-bg-subtle)] px-3 py-2 text-sm leading-5 text-[var(--tm-text-secondary)]">{slot.usageNote}</p> : null}
      {slot.availableAction === "READ_ONLY" ? <p className="mt-3 text-xs text-[var(--tm-text-secondary)]">상태 갱신 · {formatStatusChangedAt(slot.statusChangedAt)}</p> : <p className="mt-4 text-sm font-semibold text-[var(--tm-action-primary)]">자세히 보기 →</p>}
    </Link>
    {slot.availableAction === "OPEN_SESSION" ? <div className="border-t border-[var(--tm-border-subtle)] p-3"><Link className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--tm-action-primary)] px-4 text-sm font-semibold text-white" href={`/partner-sessions/open?slotId=${encodeURIComponent(slot.id)}`}>이 시간으로 세션 열기</Link></div> : null}
    {slot.availableAction === "VIEW_SESSION" && slot.session ? <div className="border-t border-[var(--tm-border-subtle)] p-3"><Link className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--tm-bg-subtle)] px-4 text-sm font-semibold text-[var(--tm-action-primary)]" href={`/matches/${slot.session.matchId}`}>{isCancelledSession ? "세션 취소 안내 보기" : "세션 자세히 보기"}</Link></div> : null}
  </article>;
}

function EmptyState() {
  return <div className="mt-5 rounded-3xl bg-[var(--tm-bg-subtle)] p-6"><p className="font-bold">지금 참여할 수 있는 제휴 코트 세션이 없어요.</p><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">다른 지역이나 날짜의 매칭도 살펴보세요.</p><Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--tm-action-primary)] underline" href="/">일반 매칭 둘러보기</Link></div>;
}
