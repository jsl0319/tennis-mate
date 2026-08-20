"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type ProfileSummary = {
  experienceLabel: string;
  rallyLevelLabel: string;
  gameExperienceLabel: string;
  activityRegion: { name: string } | null;
  playPurposes: Array<{ code: string; label: string }>;
};

type Detail = {
  title: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string;
  region: { name: string };
  court: { source: "EXTERNAL_RESERVED" | "COURT_TBD"; sourceLabel: string; name: string | null; address: string | null; courtNumber: string | null };
  playPurposes: Array<{ code: string; label: string }>;
  beginnerWelcome: boolean;
  remainingSpots: number;
  estimatedFeePerPersonKrw: number | null;
  estimatedTotalParticipants: number;
  totalCourtFeeKrw: number | null;
  additionalCostNote: string | null;
  introduction: string | null;
  partnerPreferenceLabel: string;
  recommendationReasons: Array<{ code: string; label: string }>;
  host: { nickname: string; tennisProfile: ProfileSummary | null };
  viewer: { relation: "NONE" | "HOST" | "APPLICANT"; canApply: boolean; applyBlockedReason: string | null; applicationId: string | null; tennisProfile: ProfileSummary | null };
};

function schedule(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" });
  return `${formatter.format(new Date(startsAt))}–${new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(endsAt))}`;
}

function blockedMessage(reason: string | null) {
  return ({ OWN_MATCH: "내가 만든 매칭이에요.", ALREADY_APPLIED: "이미 신청한 매칭이에요.", MATCH_NOT_OPEN: "모집이 마감됐어요.", MATCH_STARTED: "이미 시작된 일정이에요.", NO_REMAINING_SPOTS: "남은 자리가 없어요." } as Record<string, string>)[reason ?? ""] ?? "신청 가능 여부를 확인해 주세요.";
}

function apiMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string") return body.error.message;
  return fallback;
}

export function M3MatchDetail({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [applyError, setApplyError] = useState("");
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(`/api/v1/matches/${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "매칭을 불러오지 못했어요."));
      setDetail(body as Detail);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "매칭을 불러오지 못했어요."); }
  }, [matchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openSheet = () => {
    setApplyError("");
    setAlreadyApplied(false);
    setSheetOpen(true);
  };

  const submitApplication = async () => {
    setIsSubmitting(true);
    setApplyError("");
    setAlreadyApplied(false);
    try {
      const response = await fetch(`/api/v1/matches/${encodeURIComponent(matchId)}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const code = typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "code" in body.error && typeof body.error.code === "string" ? body.error.code : "";
        if (code === "APPLICATION_ALREADY_EXISTS") setAlreadyApplied(true);
        throw new Error(apiMessage(body, "신청을 보내지 못했어요."));
      }
      setSheetOpen(false);
      setSubmitted(true);
    } catch (caught) {
      setApplyError(caught instanceof Error ? caught.message : "신청을 보내지 못했어요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!detail) return <main className="grid min-h-svh place-items-center bg-[#fffdfc] px-5 text-center">{error ? <div><p>{error}</p><button className="mt-4 rounded-xl bg-[#1f7a55] px-4 py-3 text-white" onClick={() => void load()} type="button">다시 불러오기</button><Link className="ml-3 text-sm underline" href="/">홈으로</Link></div> : <p>매칭을 불러오는 중이에요…</p>}</main>;

  if (submitted) return <ApplicationSuccess title={detail.title} />;

  const hostProfile = detail.host.tennisProfile;
  return <main className="min-h-svh bg-[#fffdfc] px-5 pb-28 pt-6 text-[#1a221e]"><article className="mx-auto max-w-[560px]"><Link className="inline-flex size-11 items-center justify-center rounded-full text-xl" href="/" aria-label="홈으로 돌아가기">←</Link><div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-[#eff9f4] px-2.5 py-1 text-[#1f7a55]">{detail.statusLabel}</span>{detail.beginnerWelcome ? <span className="rounded-full bg-[#f6f4e9] px-2.5 py-1 text-[#6c5a18]">🌱 초보자 환영</span> : null}</div><h1 className="mt-4 text-2xl font-bold leading-snug">{detail.title}</h1><p className="mt-3 text-sm text-[#405047]">🗓 {schedule(detail.startsAt, detail.endsAt)}</p><p className="mt-2 text-sm text-[#405047]">📍 {detail.region.name} · 남은 자리 {detail.remainingSpots}명</p>

    {detail.recommendationReasons.length > 0 ? <section className="mt-4 flex min-h-[140px] flex-col rounded-3xl bg-[#eff9f4] p-5"><h2 className="font-bold">왜 잘 맞나요?</h2><ul className="mt-4 space-y-2 text-sm text-[#315b45]">{detail.recommendationReasons.map((reason) => <li key={reason.code}>• {reason.label}</li>)}</ul></section> : null}

    <Section title="코트와 비용"><p className="text-sm font-semibold text-[#1f7a55]">{detail.court.sourceLabel}</p>{detail.court.source === "COURT_TBD" ? <p className="mt-3 text-sm leading-6 text-[#5c6b63]">아직 정해진 코트와 비용이 없어요. 수락된 참가자와 오픈채팅에서 편하게 정해요.</p> : <><p className="mt-3 font-semibold">{detail.court.name}</p><p className="mt-1 text-sm text-[#5c6b63]">{detail.court.address}{detail.court.courtNumber ? ` · ${detail.court.courtNumber}` : ""}</p><dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt>전체 코트 비용</dt><dd>{detail.totalCourtFeeKrw?.toLocaleString("ko-KR")}원</dd></div><div className="flex justify-between gap-4 font-semibold"><dt>예상 1인 비용</dt><dd>약 {detail.estimatedFeePerPersonKrw?.toLocaleString("ko-KR")}원</dd></div></dl>{detail.additionalCostNote ? <p className="mt-3 text-sm text-[#5c6b63]">{detail.additionalCostNote}</p> : null}<p className="mt-3 text-xs leading-5 text-[#5c6b63]">예상 총 {detail.estimatedTotalParticipants}명 기준이에요. 최종 인원에 따라 실제 비용이 달라질 수 있어요.</p></>}</Section>

    <Section title="플레이 조건"><p className="text-sm">{detail.playPurposes.map((purpose) => purpose.label).join(" · ")}</p><p className="mt-2 text-sm text-[#5c6b63]">{detail.partnerPreferenceLabel}</p></Section>
    <Section title="모집자 프로필"><p className="font-semibold">{detail.host.nickname}</p>{hostProfile ? <p className="mt-2 text-sm leading-6 text-[#5c6b63]">{hostProfile.activityRegion?.name ?? "활동 지역"} · {hostProfile.experienceLabel}<br />{hostProfile.rallyLevelLabel} · {hostProfile.gameExperienceLabel}</p> : null}</Section>
    {detail.introduction ? <Section title="모집자 소개"><p className="text-sm leading-6 text-[#405047]">{detail.introduction}</p></Section> : null}
  </article><div className="fixed inset-x-0 bottom-0 border-t border-[#d8e0db] bg-white/95 px-5 py-4 backdrop-blur"><div className="mx-auto max-w-[560px]"><DetailAction detail={detail} onApply={openSheet} /></div></div>
  {sheetOpen ? <ApplicationSheet detail={detail} message={message} applyError={applyError} alreadyApplied={alreadyApplied} isSubmitting={isSubmitting} onClose={() => setSheetOpen(false)} onMessageChange={setMessage} onSubmit={() => void submitApplication()} /> : null}
  </main>;
}

function DetailAction({ detail, onApply }: { detail: Detail; onApply: () => void }) {
  if (detail.viewer.canApply) return <button className="min-h-[52px] w-full rounded-3xl bg-[#1f7a55] font-semibold text-white transition-colors hover:bg-[#176342]" onClick={onApply} type="button">같이 치기</button>;
  if (detail.viewer.relation === "APPLICANT") return <Link className="flex min-h-[52px] w-full items-center justify-center rounded-3xl bg-[#eff9f4] font-semibold text-[#1f7a55]" href="/activity/sent">검토 중이에요 · 신청 내역 보기</Link>;
  return <p className="py-4 text-center text-sm font-medium text-[#5c6b63]">{blockedMessage(detail.viewer.applyBlockedReason)}</p>;
}

function ApplicationSheet({ detail, message, applyError, alreadyApplied, isSubmitting, onClose, onMessageChange, onSubmit }: { detail: Detail; message: string; applyError: string; alreadyApplied: boolean; isSubmitting: boolean; onClose: () => void; onMessageChange: (value: string) => void; onSubmit: () => void }) {
  const profile = detail.viewer.tennisProfile;
  return <div className="fixed inset-0 z-10 flex items-end bg-black/35" onMouseDown={onClose} role="presentation"><section aria-label="같이 치기 신청" aria-modal="true" className="max-h-[88svh] w-full overflow-y-auto rounded-t-[28px] bg-[#fffdfc] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="mx-auto h-1.5 w-10 rounded-full bg-[#d8e0db]" /><div className="mx-auto max-w-[560px]"><div className="mt-5 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#1f7a55]">같이 치기 신청</p><h2 className="mt-1 text-xl font-bold">신청 전에 한 번만 확인해요</h2></div><button aria-label="신청 창 닫기" className="grid size-10 place-items-center rounded-full text-lg text-[#405047]" onClick={onClose} type="button">×</button></div>
    <div className="mt-5 space-y-3"><SummaryCard title="일정과 장소"><p>{schedule(detail.startsAt, detail.endsAt)}</p><p className="mt-1 text-sm text-[#5c6b63]">{detail.court.name ?? "코트는 함께 정해요"} · {detail.region.name}</p></SummaryCard><SummaryCard title="예상 비용"><p>{detail.estimatedFeePerPersonKrw === null ? "코트를 정한 뒤 함께 확인해요" : `약 ${detail.estimatedFeePerPersonKrw.toLocaleString("ko-KR")}원`}</p><p className="mt-1 text-sm text-[#5c6b63]">비용은 참가자끼리 별도로 정산해요.</p></SummaryCard><SummaryCard title="내 테니스 프로필"><p>{profile?.experienceLabel ?? "테니스 프로필"} · {profile?.rallyLevelLabel ?? ""}</p><p className="mt-1 text-sm text-[#5c6b63]">{profile?.playPurposes.map((purpose) => purpose.label).join(" · ") ?? ""}</p></SummaryCard></div>
    <label className="mt-5 block text-sm font-semibold" htmlFor="application-message">모집자에게 한마디 <span className="font-normal text-[#5c6b63]">(선택)</span></label><textarea className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-[#d8e0db] bg-white p-3 text-sm leading-6 outline-none placeholder:text-[#8a968f] focus:border-[#1f7a55] focus:ring-2 focus:ring-[#d9f0e4]" id="application-message" maxLength={200} onChange={(event) => onMessageChange(event.target.value)} placeholder="예: 천천히 랠리하며 같이 연습하고 싶어요." value={message} /><p className="mt-1 text-right text-xs text-[#5c6b63]">{message.length}/200</p>
    {applyError ? <div className="mt-3 rounded-2xl bg-[#fff1ef] px-4 py-3 text-sm text-[#a13d32]"><p>{applyError}</p>{alreadyApplied ? <Link className="mt-2 inline-block font-semibold underline" href="/activity/sent">신청 내역 보기</Link> : null}</div> : null}
    <div className="mt-5 flex gap-3"><button className="min-h-[52px] flex-1 rounded-2xl border border-[#d8e0db] font-semibold text-[#405047]" disabled={isSubmitting} onClick={onClose} type="button">생각해볼게요</button><button className="min-h-[52px] flex-[1.4] rounded-2xl bg-[#1f7a55] font-semibold text-white disabled:opacity-50" disabled={isSubmitting} onClick={onSubmit} type="button">{isSubmitting ? "신청 보내는 중…" : "신청하기"}</button></div>
  </div></section></div>;
}

function SummaryCard({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="rounded-2xl border border-[#d8e0db] bg-white px-4 py-3"><h3 className="text-xs font-semibold text-[#5c6b63]">{title}</h3><div className="mt-1.5 text-sm font-semibold leading-6 text-[#1a221e]">{children}</div></section>;
}

function ApplicationSuccess({ title }: { title: string }) {
  return <main className="grid min-h-svh place-items-center bg-[#fffdfc] px-5 text-[#1a221e]"><section className="w-full max-w-[390px] rounded-[28px] bg-white p-6 text-center shadow-[0_10px_40px_rgba(23,67,45,0.09)]"><p className="text-4xl">🎾</p><h1 className="mt-4 text-2xl font-bold">신청을 보냈어요</h1><p className="mt-3 text-sm leading-6 text-[#5c6b63]"><strong className="font-semibold text-[#1a221e]">{title}</strong><br />모집자가 프로필을 확인하면 결과를 알려드릴게요.</p><Link className="mt-6 flex min-h-[52px] items-center justify-center rounded-2xl bg-[#1f7a55] font-semibold text-white" href="/activity/sent">신청 내역 보기</Link></section></main>;
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="mt-4 flex min-h-[140px] flex-col rounded-3xl border border-[#d8e0db] bg-white p-5"><h2 className="font-bold">{title}</h2><div className="mt-4">{children}</div></section>;
}
