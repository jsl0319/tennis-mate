"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";
import { BackButton } from "@/components/navigation/back-button";
import { CourtMedia } from "@/features/matches/court-media";

import { apiMessage, formatPartnerSchedule, formatStatusChangedAt, type PublicCourtSlot } from "./partner-session";

export function PartnerSessionDetail({ slotId }: { slotId: string }) {
  const [slot, setSlot] = useState<PublicCourtSlot | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(`/api/v1/partner-session-slots/${encodeURIComponent(slotId)}`, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "제휴 코트 시간을 불러오지 못했어요."));
      setSlot(body as PublicCourtSlot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "제휴 코트 시간을 불러오지 못했어요.");
    }
  }, [slotId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!slot) return <main className="grid min-h-svh place-items-center bg-[var(--tm-bg-page)] px-5 text-center text-[var(--tm-text-primary)]">{error ? <div><p className="text-lg font-bold">제휴 코트 시간을 확인할 수 없어요</p><p className="mt-2 text-sm text-[var(--tm-text-secondary)]">{error}</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--tm-action-primary)] px-4 font-semibold text-white" href="/partner-sessions">제휴 코트 목록 보기</Link></div> : <CourtRallyLoader label="제휴 코트 시간을 준비하고 있어요." />}</main>;

  const canOpen = slot.availableAction === "OPEN_SESSION";
  const isCancelledSession = slot.session?.status === "CANCELLED";
  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 pb-28 pt-6 text-[var(--tm-text-primary)]"><article className="mx-auto max-w-[560px]"><BackButton className="inline-flex size-11 items-center justify-center rounded-full text-xl" fallbackPath="/partner-sessions" /><CourtMedia alt={`${slot.court.name} 코트 이미지`} className="mt-4 aspect-[7/4] w-full" fallbackLabel="Tennis Mate 기본 코트 이미지" image={slot.court.image} priority />
    <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[var(--tm-bg-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--tm-action-primary)]">Tennis Mate 제휴 코트</span><span className="rounded-full bg-[var(--tm-bg-highlight)] px-2.5 py-1 text-xs font-semibold text-[var(--tm-tennis-ball-muted)]">{slot.statusLabel}</span></div>
    <h1 className="mt-4 text-2xl font-bold">{canOpen ? "이 시간으로 세션을 열어 보세요" : slot.availableAction === "VIEW_SESSION" ? isCancelledSession ? "세션이 취소됐어요" : "지금 세션을 모집하고 있어요" : "현재 상태를 확인해 주세요"}</h1>
    <p className="mt-3 text-sm leading-6 text-[var(--tm-text-secondary)]">Tennis Mate에서 준비한 코트예요. 참가 신청은 세션을 연 모집자에게 보내요.</p>
    <section className="mt-5 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5"><h2 className="font-bold">코트와 시간</h2><p className="mt-4 text-sm leading-6 text-[var(--tm-text-secondary)]">🗓 {formatPartnerSchedule(slot.startsAt, slot.endsAt)}<br />📍 {slot.court.name} · {slot.court.courtNumber}<br />{slot.court.address}</p></section>
    <section className="mt-4 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5"><h2 className="font-bold">비용과 현장 안내</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt>전체 코트 비용</dt><dd className="font-semibold">{slot.totalCourtFeeKrw.toLocaleString("ko-KR")}원</dd></div><div className="flex justify-between gap-4"><dt>현장 최대 인원</dt><dd className="font-semibold">{slot.maxParticipantCount}명</dd></div></dl>{slot.usageNote ? <p className="mt-4 rounded-2xl bg-[var(--tm-bg-subtle)] px-4 py-3 text-sm leading-6 text-[var(--tm-text-secondary)]">{slot.usageNote}</p> : null}<p className="mt-4 text-xs leading-5 text-[var(--tm-text-secondary)]">비용은 Tennis Mate에서 결제하지 않아요. 세션을 연 뒤 참가자끼리 따로 확인해요.</p></section>
    {!canOpen && slot.availableAction === "READ_ONLY" ? <p className="mt-4 rounded-2xl bg-[var(--tm-bg-subtle)] px-4 py-3 text-sm leading-6 text-[var(--tm-text-secondary)]">{slot.statusLabel} · 상태 갱신 {formatStatusChangedAt(slot.statusChangedAt)}</p> : null}
  </article><div className="fixed inset-x-0 bottom-0 border-t border-[var(--tm-border-default)] bg-white/95 px-5 py-4 backdrop-blur"><div className="mx-auto max-w-[560px]">{canOpen ? <Link className="flex min-h-[52px] items-center justify-center rounded-3xl bg-[var(--tm-action-primary)] font-semibold text-white" href={`/partner-sessions/open?slotId=${encodeURIComponent(slot.id)}`}>이 시간으로 세션 열기</Link> : slot.availableAction === "VIEW_SESSION" && slot.session ? <Link className="flex min-h-[52px] items-center justify-center rounded-3xl bg-[var(--tm-action-primary)] font-semibold text-white" href={`/matches/${slot.session.matchId}`}>{isCancelledSession ? "세션 취소 안내 보기" : "세션 자세히 보기"}</Link> : <p className="py-3 text-center text-sm text-[var(--tm-text-secondary)]">이 시간은 현재 새 세션에 연결할 수 없어요.</p>}</div></div>
  </main>;
}
