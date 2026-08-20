"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type Detail = {
  title: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string;
  region: { name: string };
  court: { sourceLabel: string; name: string; address: string; courtNumber: string | null };
  playPurposes: Array<{ code: string; label: string }>;
  beginnerWelcome: boolean;
  remainingSpots: number;
  estimatedFeePerPersonKrw: number;
  estimatedTotalParticipants: number;
  totalCourtFeeKrw: number;
  additionalCostNote: string | null;
  introduction: string | null;
  partnerPreferenceLabel: string;
  recommendationReasons: Array<{ code: string; label: string }>;
  host: { nickname: string; tennisProfile: null | { experienceLabel: string; rallyLevelLabel: string; gameExperienceLabel: string; activityRegion: { name: string } | null; playPurposes: Array<{ code: string; label: string }> } };
  viewer: { relation: "NONE" | "HOST" | "APPLICANT"; canApply: boolean; applyBlockedReason: string | null };
};

function schedule(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" });
  return `${formatter.format(new Date(startsAt))}–${new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(endsAt))}`;
}

function blockedMessage(reason: string | null) {
  return ({ OWN_MATCH: "내가 만든 매칭이에요.", ALREADY_APPLIED: "이미 신청한 매칭이에요.", MATCH_NOT_OPEN: "모집이 마감됐어요.", MATCH_STARTED: "이미 시작된 일정이에요.", NO_REMAINING_SPOTS: "남은 자리가 없어요." } as Record<string, string>)[reason ?? ""] ?? "신청 가능 여부를 확인해 주세요.";
}

export function M3MatchDetail({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/matches/${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string" ? body.error.message : "매칭을 불러오지 못했어요.");
      setDetail(body as Detail);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "매칭을 불러오지 못했어요."); }
  }, [matchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!detail) return <main className="grid min-h-svh place-items-center bg-[#fffdfc] px-5 text-center">{error ? <div><p>{error}</p><button className="mt-4 rounded-xl bg-[#1f7a55] px-4 py-3 text-white" onClick={() => void load()} type="button">다시 불러오기</button><Link className="ml-3 text-sm underline" href="/">홈으로</Link></div> : <p>매칭을 불러오는 중이에요…</p>}</main>;

  const hostProfile = detail.host.tennisProfile;
  return <main className="min-h-svh bg-[#fffdfc] px-5 pb-28 pt-6 text-[#1a221e]"><article className="mx-auto max-w-[560px]"><Link className="inline-flex size-11 items-center justify-center rounded-full text-xl" href="/" aria-label="홈으로 돌아가기">←</Link><div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-[#eff9f4] px-2.5 py-1 text-[#1f7a55]">{detail.statusLabel}</span>{detail.beginnerWelcome ? <span className="rounded-full bg-[#f6f4e9] px-2.5 py-1 text-[#6c5a18]">🌱 초보자 환영</span> : null}</div><h1 className="mt-4 text-2xl font-bold leading-snug">{detail.title}</h1><p className="mt-3 text-sm text-[#405047]">🗓 {schedule(detail.startsAt, detail.endsAt)}</p><p className="mt-2 text-sm text-[#405047]">📍 {detail.region.name} · 남은 자리 {detail.remainingSpots}명</p>

    {detail.recommendationReasons.length > 0 ? <section className="mt-4 flex min-h-[140px] flex-col rounded-3xl bg-[#eff9f4] p-5"><h2 className="font-bold">왜 잘 맞나요?</h2><ul className="mt-4 space-y-2 text-sm text-[#315b45]">{detail.recommendationReasons.map((reason) => <li key={reason.code}>• {reason.label}</li>)}</ul></section> : null}

    <Section title="코트와 비용"><p className="text-sm font-semibold text-[#1f7a55]">{detail.court.sourceLabel}</p><p className="mt-3 font-semibold">{detail.court.name}</p><p className="mt-1 text-sm text-[#5c6b63]">{detail.court.address}{detail.court.courtNumber ? ` · ${detail.court.courtNumber}` : ""}</p><dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt>전체 코트 비용</dt><dd>{detail.totalCourtFeeKrw.toLocaleString("ko-KR")}원</dd></div><div className="flex justify-between gap-4 font-semibold"><dt>예상 1인 비용</dt><dd>약 {detail.estimatedFeePerPersonKrw.toLocaleString("ko-KR")}원</dd></div></dl>{detail.additionalCostNote ? <p className="mt-3 text-sm text-[#5c6b63]">{detail.additionalCostNote}</p> : null}<p className="mt-3 text-xs leading-5 text-[#5c6b63]">예상 총 {detail.estimatedTotalParticipants}명 기준이에요. 최종 인원에 따라 실제 비용이 달라질 수 있어요.</p></Section>

    <Section title="플레이 조건"><p className="text-sm">{detail.playPurposes.map((purpose) => purpose.label).join(" · ")}</p><p className="mt-2 text-sm text-[#5c6b63]">{detail.partnerPreferenceLabel}</p></Section>
    <Section title="모집자 프로필"><p className="font-semibold">{detail.host.nickname}</p>{hostProfile ? <p className="mt-2 text-sm leading-6 text-[#5c6b63]">{hostProfile.activityRegion?.name ?? "활동 지역"} · {hostProfile.experienceLabel}<br />{hostProfile.rallyLevelLabel} · {hostProfile.gameExperienceLabel}</p> : null}</Section>
    {detail.introduction ? <Section title="모집자 소개"><p className="text-sm leading-6 text-[#405047]">{detail.introduction}</p></Section> : null}
  </article><div className="fixed inset-x-0 bottom-0 border-t border-[#d8e0db] bg-white/95 px-5 py-4 backdrop-blur"><div className="mx-auto max-w-[560px]">{detail.viewer.canApply ? <button className="min-h-[52px] w-full rounded-3xl bg-[#1f7a55] font-semibold text-white disabled:opacity-50" disabled type="button">같이 치기 · 다음 단계에서 지원해요</button> : <p className="text-center text-sm font-medium text-[#5c6b63]">{blockedMessage(detail.viewer.applyBlockedReason)}</p>}</div></div></main>;
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="mt-4 flex min-h-[140px] flex-col rounded-3xl border border-[#d8e0db] bg-white p-5"><h2 className="font-bold">{title}</h2><div className="mt-4">{children}</div></section>;
}
