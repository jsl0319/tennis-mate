"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

import { ActivityTabs } from "@/components/navigation/activity-tabs";
import { BackButton } from "@/components/navigation/back-button";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";

type HostedMatch = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string;
  court: { source: "EXTERNAL_RESERVED" | "COURT_TBD"; name: string | null };
  recruitCount: number;
  acceptedCount: number;
  remainingSpots: number;
  pendingApplicationCount: number;
  version: number;
  canClose: boolean;
  canCancel: boolean;
  canComplete: boolean;
  contact: { type: "KAKAO_OPEN_CHAT"; url: string; label: string };
};

type ProfileSnapshot = {
  experienceLabel?: string;
  rallyLevelLabel?: string;
  gameExperienceLabel?: string;
  activityRegion?: { name?: string } | null;
  playPurposes?: Array<{ label?: string }>;
};

type ReceivedApplication = {
  id: string;
  status: string;
  statusLabel: string;
  message: string | null;
  applicant: { nickname: string; profileSnapshot: ProfileSnapshot };
  createdAt: string;
};

type ReceivedResponse = {
  match: HostedMatch & { version: number; pendingApplicationCount: number };
  items: ReceivedApplication[];
};

function apiMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string") return body.error.message;
  return fallback;
}

function schedule(startsAt: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(startsAt));
}

function snapshotSummary(snapshot: ProfileSnapshot) {
  return [snapshot.experienceLabel, snapshot.rallyLevelLabel, snapshot.activityRegion?.name].filter(Boolean).join(" · ");
}

function snapshotDetails(snapshot: ProfileSnapshot) {
  return [snapshot.gameExperienceLabel, snapshot.playPurposes?.map((purpose) => purpose.label).filter(Boolean).join(" · ")].filter(Boolean).join(" · ");
}

function hostCoordinationMessage(courtSource: HostedMatch["court"]["source"]) {
  return courtSource === "COURT_TBD"
    ? "수락된 참가자와 오픈채팅에서 코트와 비용을 조율해요."
    : "수락된 참가자와 오픈채팅에서 당일 준비와 비용 정산 방법을 확인해요.";
}

function useJsonLoader<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(url, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "정보를 불러오지 못했어요."));
      setData(body as T);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "정보를 불러오지 못했어요."); }
  }, [url]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return { data, error, load };
}

function PageShell({ children, withNavigation = false }: { children: React.ReactNode; withNavigation?: boolean }) {
  return <main className={`min-h-svh bg-[#fffdfc] px-5 pt-6 text-[#1a221e] ${withNavigation ? "pb-28" : "pb-10"}`}><div className="mx-auto max-w-[560px]">{children}</div>{withNavigation ? <BottomNavigation /> : null}</main>;
}

function LoadingOrError({ error, load }: { error: string; load: () => Promise<void> }) {
  return error ? <section className="mt-8 rounded-3xl border border-[#d8e0db] bg-white p-5"><p>{error}</p><button className="mt-4 rounded-2xl bg-[#1f7a55] px-4 py-3 text-sm font-semibold text-white" onClick={() => void load()} type="button">다시 불러오기</button></section> : <p className="mt-12 text-center text-sm text-[#5c6b63]">신청 정보를 불러오는 중이에요…</p>;
}

export function M6ReceivedApplications() {
  const { data, error, load } = useJsonLoader<{ items: HostedMatch[] }>("/api/v1/me/hosted-matches");
  return <PageShell withNavigation>
    <p className="text-sm font-semibold text-[#1f7a55]">활동</p>
    <h1 className="mt-1 text-2xl font-bold">받은 신청</h1>
    <ActivityTabs current="received" />
    <p className="mt-4 text-sm leading-6 text-[#5c6b63]">내가 만든 매칭에 들어온 신청을 한곳에서 확인해요.</p>
    {data === null ? <LoadingOrError error={error} load={load} /> : data.items.length === 0 ? <EmptyHostedMatches /> : <div className="mt-6 space-y-4">{data.items.map((match) => <HostedMatchCard key={match.id} match={match} onChanged={load} />)}</div>}
  </PageShell>;
}

function EmptyHostedMatches() {
  return <section className="mt-10 rounded-3xl border border-dashed border-[#c7d6ce] bg-white px-5 py-10 text-center"><p className="text-2xl">🎾</p><h2 className="mt-4 font-bold">아직 만든 매칭이 없어요</h2><p className="mt-2 text-sm leading-6 text-[#5c6b63]">코트 예약 전에도 일정과 지역을 정해 메이트를 모집할 수 있어요.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white" href="/matches/new">매칭 만들기</Link></section>;
}

function HostedMatchCard({ match, onChanged }: { match: HostedMatch; onChanged: () => Promise<void> }) {
  const [action, setAction] = useState<"close" | "cancel" | "complete" | null>(null);
  const [confirmAction, setConfirmAction] = useState<"close" | "cancel" | "complete" | null>(null);
  const [error, setError] = useState("");
  const runAction = async (nextAction: "close" | "cancel" | "complete") => {
    setAction(nextAction); setError("");
    try {
      const response = await fetch(`/api/v1/matches/${encodeURIComponent(match.id)}/${nextAction}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextAction === "cancel" ? { expectedVersion: match.version, reason: null } : { expectedVersion: match.version }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "매칭 상태를 변경하지 못했어요."));
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "매칭 상태를 변경하지 못했어요."); } finally { setAction(null); }
  };
  return <>
    <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-[0_4px_14px_rgba(23,67,45,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-h-7 items-center whitespace-nowrap rounded-full bg-[#eff9f4] px-2.5 py-1 text-xs font-semibold text-[#1f7a55]">{match.statusLabel}</span>
        {match.pendingApplicationCount > 0 ? <span className="inline-flex min-h-7 items-center whitespace-nowrap rounded-full bg-[#eff9f4] px-2.5 py-1 text-xs font-semibold text-[#1f7a55]">검토할 신청 {match.pendingApplicationCount}건</span> : null}
      </div>
      <h2 className="mt-4 text-lg font-bold">{match.title}</h2>
      <p className="mt-3 text-sm text-[#405047]">🗓 {schedule(match.startsAt)}</p>
      <p className="mt-1 text-sm text-[#405047]">📍 {match.court.name ?? "코트와 비용을 함께 정해요"}</p>
      <p className="mt-4 border-t border-[#edf0ee] pt-3 text-sm font-semibold">수락 {match.acceptedCount}명 / 모집 {match.recruitCount}명 <span className="font-normal text-[#5c6b63]">· 남은 자리 {match.remainingSpots}명</span></p>
      {match.acceptedCount > 0 && match.status !== "COMPLETED" ? <>
        <p className="mt-4 rounded-2xl bg-[#eff9f4] px-4 py-3 text-sm leading-6 text-[#315b45]">{hostCoordinationMessage(match.court.source)}</p>
        <a className="mt-3 flex min-h-[52px] items-center justify-center rounded-2xl border border-[#9fc9b1] px-4 text-center text-sm font-semibold text-[#1f7a55]" href={match.contact.url} rel="noreferrer" target="_blank">{match.contact.label}</a>
      </> : null}
      {match.pendingApplicationCount > 0 ? <Link className="mt-4 flex min-h-[52px] items-center justify-center rounded-2xl bg-[#1f7a55] px-4 text-center text-sm font-semibold text-white" href={`/activity/received/${match.id}`}>신청자 보기</Link> : <p className="mt-4 text-sm text-[#5c6b63]">{match.status === "COMPLETED" ? "함께한 일정이 완료됐어요." : "새로 검토할 신청을 기다리고 있어요."}</p>}
      {match.canComplete ? <button className="mt-3 min-h-[52px] w-full rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={action !== null} onClick={() => setConfirmAction("complete")} type="button">플레이 완료하기</button> : null}
      {match.canClose ? <button className="mt-3 min-h-11 w-full rounded-2xl border border-[#d8e0db] px-4 text-sm font-semibold text-[#405047] disabled:opacity-50" disabled={action !== null} onClick={() => setConfirmAction("close")} type="button">모집 마감</button> : null}
      {match.canCancel ? <button className="mt-3 min-h-11 w-full rounded-2xl px-4 text-sm font-semibold text-[#5c6b63] disabled:opacity-50" disabled={action !== null} onClick={() => setConfirmAction("cancel")} type="button">매칭 취소</button> : null}
      {error ? <p className="mt-3 rounded-2xl bg-[#fff1ef] px-4 py-3 text-sm text-[#a13d32]">{error}</p> : null}
    </section>
    {confirmAction ? <LifecycleConfirm action={confirmAction} busy={action !== null} onCancel={() => setConfirmAction(null)} onConfirm={() => { setConfirmAction(null); void runAction(confirmAction); }} /> : null}
  </>;
}

function LifecycleConfirm({ action, busy, onCancel, onConfirm }: { action: "close" | "cancel" | "complete"; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const copy = action === "complete" ? { title: "플레이를 완료할까요?", body: "완료하면 수락된 참가자에게도 ‘완료’로 표시돼요.", confirm: "네, 완료할게요" } : action === "close" ? { title: "모집을 마감할까요?", body: "남은 대기 신청은 ‘모집이 마감됐어요’로 표시돼요.", confirm: "네, 마감할게요" } : { title: "매칭을 취소할까요?", body: "수락된 참가자와 대기 신청자에게 취소로 표시돼요.", confirm: "네, 취소할게요" };
  return <div className="fixed inset-0 z-20 flex items-end bg-black/35 px-5 pb-[max(20px,env(safe-area-inset-bottom))]" role="presentation"><section aria-label={copy.title} aria-modal="true" className="mx-auto w-full max-w-[560px] rounded-[28px] bg-[#fffdfc] p-5" role="dialog"><p className="text-sm font-semibold text-[#1f7a55]">한 번만 확인해요</p><h2 className="mt-2 text-xl font-bold">{copy.title}</h2><p className="mt-3 text-sm leading-6 text-[#5c6b63]">{copy.body}</p><div className="mt-6 space-y-3"><button className="min-h-[52px] w-full rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={onConfirm} type="button">{busy ? "처리 중…" : copy.confirm}</button><button className="min-h-[52px] w-full rounded-2xl border border-[#d8e0db] px-4 text-sm font-semibold text-[#405047]" disabled={busy} onClick={onCancel} type="button">돌아가기</button></div></section></div>;
}

export function M6ReceivedMatch({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const { data, error, load } = useJsonLoader<ReceivedResponse>(`/api/v1/matches/${encodeURIComponent(matchId)}/applications?status=PENDING`);
  if (data === null) return <PageShell><BackButton className="inline-flex size-11 items-center justify-center rounded-full text-xl" fallbackPath="/activity/received" /><LoadingOrError error={error} load={load} /></PageShell>;
  return <PageShell>
    <BackButton className="inline-flex size-11 items-center justify-center rounded-full text-xl" fallbackPath="/activity/received" />
    <p className="mt-5 text-sm font-semibold text-[#1f7a55]">받은 신청</p>
    <h1 className="mt-1 text-2xl font-bold">신청자 {data.match.pendingApplicationCount}명을 검토해요</h1>
    <p className="mt-2 text-sm leading-6 text-[#5c6b63]">신청 내용을 보고 함께 치기 좋은 분을 선택하세요.</p>
    <section className="mt-6 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-[0_4px_14px_rgba(23,67,45,0.05)]">
      <div className="flex items-center justify-between gap-3"><span className="inline-flex min-h-7 items-center whitespace-nowrap rounded-full bg-[#eff9f4] px-2.5 py-1 text-xs font-semibold text-[#1f7a55]">{data.match.statusLabel}</span><span className="inline-flex min-h-7 items-center whitespace-nowrap rounded-full bg-[#eff9f4] px-2.5 py-1 text-xs font-semibold text-[#1f7a55]">검토할 신청 {data.match.pendingApplicationCount}건</span></div>
      <h2 className="mt-4 text-lg font-bold">{data.match.title}</h2>
      <p className="mt-3 text-sm text-[#405047]">🗓 {schedule(data.match.startsAt)} · {data.match.court.name ?? "코트와 비용을 함께 정해요"}</p>
      <p className="mt-3 text-sm font-semibold">수락 {data.match.acceptedCount}명 / 모집 {data.match.recruitCount}명 <span className="font-normal text-[#5c6b63]">· 남은 자리 {data.match.remainingSpots}명</span></p>
    </section>
    {data.items.length === 0 ? <section className="mt-6 rounded-3xl border border-dashed border-[#c7d6ce] bg-white px-5 py-10 text-center"><h2 className="font-bold">검토할 신청을 모두 확인했어요</h2><p className="mt-2 text-sm text-[#5c6b63]">새 신청이 오면 여기에서 확인할 수 있어요.</p></section> : <div className="mt-4 grid gap-4">{data.items.map((application) => <ApplicantCard application={application} matchId={matchId} key={application.id} />)}</div>}
  </PageShell>;
}

function ApplicantCard({ application, matchId }: { application: ReceivedApplication; matchId: string }) {
  const snapshot = application.applicant.profileSnapshot;
  return <Link className="block rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-[0_4px_14px_rgba(23,67,45,0.05)] transition-colors hover:border-[#9fc9b1]" href={`/activity/received/${matchId}/applications/${application.id}`}><div className="flex items-center justify-between gap-3"><span className="inline-flex min-h-7 items-center whitespace-nowrap rounded-full bg-[#eff9f4] px-2.5 py-1 text-xs font-semibold text-[#1f7a55]">{application.statusLabel}</span><span className="text-xs font-semibold text-[#1f7a55]">신청 내용 보기 →</span></div><h2 className="mt-4 text-lg font-bold">{application.applicant.nickname}님</h2><p className="mt-2 text-sm leading-6 text-[#5c6b63]">{snapshotSummary(snapshot)}</p><p className="mt-1 text-sm leading-6 text-[#5c6b63]">{snapshotDetails(snapshot)}</p>{application.message ? <p className="mt-4 border-t border-[#edf0ee] pt-3 text-sm leading-6 text-[#405047]">“{application.message}”</p> : null}</Link>;
}

export function M6ApplicantReview({ params }: { params: Promise<{ matchId: string; applicationId: string }> }) {
  const { matchId, applicationId } = use(params);
  const { data, error, load } = useJsonLoader<ReceivedResponse>(`/api/v1/matches/${encodeURIComponent(matchId)}/applications?status=PENDING`);
  const [decision, setDecision] = useState<"ACCEPT" | "REJECT" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [completed, setCompleted] = useState<{ type: "ACCEPT" | "REJECT"; remainingSpots?: number; isFull?: boolean } | null>(null);
  const application = data?.items.find((item) => item.id === applicationId) ?? null;

  const decide = async () => {
    if (!data || !decision || !application) return;
    setSubmitting(true); setDecisionError("");
    try {
      const response = await fetch(`/api/v1/applications/${encodeURIComponent(application.id)}/${decision === "ACCEPT" ? "accept" : "reject"}`, { method: "POST", headers: { "Content-Type": "application/json" }, ...(decision === "ACCEPT" ? { body: JSON.stringify({ expectedMatchVersion: data.match.version }) } : {}) });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "신청 상태를 변경하지 못했어요."));
      const match = typeof body === "object" && body !== null && "match" in body && typeof body.match === "object" && body.match !== null ? body.match as { remainingSpots?: number; status?: string } : null;
      setCompleted({ type: decision, remainingSpots: match?.remainingSpots, isFull: match?.status === "CLOSED" });
      setDecision(null);
    } catch (caught) { setDecisionError(caught instanceof Error ? caught.message : "신청 상태를 변경하지 못했어요."); } finally { setSubmitting(false); }
  };

  return <PageShell><BackButton className="inline-flex size-11 items-center justify-center rounded-full text-xl" fallbackPath={`/activity/received/${matchId}`} />{data === null ? <LoadingOrError error={error} load={load} /> : !application ? <section className="mt-10 rounded-3xl border border-[#d8e0db] bg-white p-5"><h1 className="text-xl font-bold">이미 처리된 신청이에요</h1><p className="mt-2 text-sm leading-6 text-[#5c6b63]">최신 신청 목록을 확인해 주세요.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white" href={`/activity/received/${matchId}`}>신청 목록 보기</Link></section> : completed ? <DecisionSuccess matchId={matchId} result={completed} /> : <ApplicantReviewContent application={application} data={data} decisionError={decisionError} onDecision={setDecision} />}{decision ? <DecisionConfirm application={application} decision={decision} error={decisionError} submitting={submitting} remainingSpots={data?.match.remainingSpots ?? 0} onCancel={() => setDecision(null)} onConfirm={() => void decide()} /> : null}</PageShell>;
}

function ApplicantReviewContent({ application, data, decisionError, onDecision }: { application: ReceivedApplication; data: ReceivedResponse; decisionError: string; onDecision: (decision: "ACCEPT" | "REJECT") => void }) {
  const snapshot = application.applicant.profileSnapshot;
  return <><p className="mt-5 text-sm font-semibold text-[#1f7a55]">{data.match.title} · 검토할 신청</p><h1 className="mt-1 text-2xl font-bold">{application.applicant.nickname}님을 검토해요</h1><section className="mt-6 rounded-3xl bg-[#eff9f4] p-5"><p className="text-sm font-semibold text-[#1f7a55]">신청 당시 테니스 프로필</p><h2 className="mt-3 text-lg font-bold">{snapshotSummary(snapshot)}</h2><p className="mt-2 text-sm leading-6 text-[#5c6b63]">{snapshotDetails(snapshot)}</p></section><section className="mt-4 rounded-3xl border border-[#d8e0db] bg-white p-5"><h2 className="font-bold">신청 메시지</h2><p className="mt-3 text-sm leading-6 text-[#405047]">{application.message ? `“${application.message}”` : "남긴 메시지가 없어요."}</p></section>{decisionError ? <p className="mt-4 rounded-2xl bg-[#fff1ef] px-4 py-3 text-sm text-[#a13d32]">{decisionError}</p> : null}<div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-[52px] w-full rounded-2xl border border-[#d8e0db] px-3 text-center font-semibold text-[#405047]" onClick={() => onDecision("REJECT")} type="button">이번에는 어려워요</button><button className="min-h-[52px] w-full rounded-2xl bg-[#1f7a55] px-3 text-center font-semibold text-white" onClick={() => onDecision("ACCEPT")} type="button">수락하기</button></div></>;
}

function DecisionConfirm({ application, decision, error, submitting, remainingSpots, onCancel, onConfirm }: { application: ReceivedApplication | null; decision: "ACCEPT" | "REJECT"; error: string; submitting: boolean; remainingSpots: number; onCancel: () => void; onConfirm: () => void }) {
  if (!application) return null;
  const accepting = decision === "ACCEPT";
  return <div className="fixed inset-0 z-10 flex items-end bg-black/35" onMouseDown={onCancel} role="presentation"><section aria-modal="true" className="w-full rounded-t-[28px] bg-[#fffdfc] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="mx-auto h-1.5 w-10 rounded-full bg-[#d8e0db]" /><div className="mx-auto max-w-[560px]"><h2 className="mt-6 text-xl font-bold">{accepting ? `${application.applicant.nickname}님과 함께 치기로 할까요?` : "이번 신청을 정중하게 마무리할까요?"}</h2><p className="mt-3 text-sm leading-6 text-[#5c6b63]">{accepting ? `수락하면 남은 자리가 ${Math.max(remainingSpots - 1, 0)}자리예요.${remainingSpots === 1 ? " 마지막 자리라면 다른 대기 신청은 자동으로 마감돼요." : ""}` : "상대방에게는 ‘이번에는 함께하기 어려워요’라고 표시돼요."}</p>{error ? <p className="mt-4 rounded-2xl bg-[#fff1ef] px-4 py-3 text-sm text-[#a13d32]">{error}</p> : null}<div className="mt-6 grid grid-cols-2 gap-3"><button className="min-h-[52px] w-full rounded-2xl border border-[#d8e0db] px-3 text-center font-semibold text-[#405047]" disabled={submitting} onClick={onCancel} type="button">취소</button><button className="min-h-[52px] w-full rounded-2xl bg-[#1f7a55] px-3 text-center font-semibold text-white disabled:opacity-50" disabled={submitting} onClick={onConfirm} type="button">{submitting ? "처리 중…" : accepting ? "네, 함께 칠게요" : "이번에는 어려워요"}</button></div></div></section></div>;
}

function DecisionSuccess({ matchId, result }: { matchId: string; result: { type: "ACCEPT" | "REJECT"; remainingSpots?: number; isFull?: boolean } }) {
  const accepted = result.type === "ACCEPT";
  return <section className="mt-20 rounded-[28px] bg-white p-6 text-center shadow-[0_10px_40px_rgba(23,67,45,0.09)]"><p className="text-4xl">{accepted ? "🎾" : "✓"}</p><h1 className="mt-4 text-2xl font-bold">{accepted ? "같이 치기로 했어요" : "신청을 정중히 마무리했어요"}</h1><p className="mt-3 text-sm leading-6 text-[#5c6b63]">{accepted ? result.isFull ? "정원이 채워져 남은 신청은 자동으로 마감됐어요." : `남은 자리는 ${result.remainingSpots ?? 0}자리예요.` : "신청자에게 결과가 전달돼요."}</p><Link className="mt-6 flex min-h-[52px] items-center justify-center rounded-2xl bg-[#1f7a55] font-semibold text-white" href={`/activity/received/${matchId}`}>신청 목록 보기</Link></section>;
}
