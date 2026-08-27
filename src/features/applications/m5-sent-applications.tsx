"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ActivityTabs } from "@/components/navigation/activity-tabs";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";

type SentApplication = {
  id: string;
  status: string;
  statusLabel: string;
  message: string | null;
  match: { id: string; title: string; status: string; startsAt: string; courtSource: "EXTERNAL_RESERVED" | "COURT_TBD" | "PARTNER_COURT"; courtName: string | null; regionName: string; estimatedFeePerPersonKrw: number | null };
  contact: { type: "KAKAO_OPEN_CHAT"; url: string; label: string } | null;
  supplyNotice: { code: "COURT_SUPPLY_WITHDRAWN"; message: string; occurredAt: string; delivery: "IN_APP" } | null;
  createdAt: string;
};

function schedule(startsAt: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(startsAt));
}

function appliedDate(createdAt: string) {
  return `신청한 ${new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(createdAt))}`;
}

function nextStepMessage(status: string, matchStatus: string) {
  return ({
    PENDING: "모집자가 프로필을 확인하고 있어요.",
    ACCEPTED: "같이 치게 됐어요. 매칭 정보를 확인해 주세요.",
    REJECTED: "이번에는 함께하기 어려워요. 다른 추천 매치를 찾아볼 수 있어요.",
    WITHDRAWN: "신청을 철회했어요.",
    CANCELLED: matchStatus === "CANCELLED"
      ? "모집자가 매칭을 취소했어요."
      : matchStatus === "EXPIRED"
        ? "일정이 시작되어 매칭이 성사되지 않았어요."
        : "모집이 마감되어 이번 신청은 진행되지 않아요.",
  } as Record<string, string>)[status] ?? "매칭 상태를 확인해 주세요.";
}

function acceptedCoordinationMessage(courtSource: SentApplication["match"]["courtSource"]) {
  return courtSource === "COURT_TBD"
    ? "수락된 참가자끼리 오픈채팅에서 코트와 비용을 조율해요."
    : courtSource === "PARTNER_COURT"
      ? "Tennis Mate에서 준비한 코트예요. 수락된 뒤 당일 준비와 비용 정산 방법을 확인해요."
    : "수락된 참가자끼리 오픈채팅에서 당일 준비와 비용 정산 방법을 확인해요.";
}

function getErrorMessage(body: unknown, fallback: string) {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string" ? body.error.message : fallback;
}

export function M5SentApplications() {
  const [items, setItems] = useState<SentApplication[] | null>(null);
  const [error, setError] = useState("");
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [withdrawConfirmId, setWithdrawConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/v1/me/applications", { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body, "신청 내역을 불러오지 못했어요."));
      setItems((body as { items: SentApplication[] }).items);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "신청 내역을 불러오지 못했어요."); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const withdraw = async (applicationId: string) => {
    setWithdrawingId(applicationId);
    setError("");
    try {
      const response = await fetch(`/api/v1/applications/${encodeURIComponent(applicationId)}/withdraw`, { method: "POST" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body, "신청을 철회하지 못했어요."));
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "신청을 철회하지 못했어요."); } finally { setWithdrawingId(null); }
  };

  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 pb-28 pt-6 text-[var(--tm-text-primary)]">
    <div className="mx-auto max-w-[560px]">
      <p className="text-sm font-semibold text-[var(--tm-action-primary)]">활동</p>
      <h1 className="mt-1 text-2xl font-bold">보낸 신청</h1>
      <ActivityTabs current="sent" />
      <p className="mt-4 text-sm leading-6 text-[var(--tm-text-secondary)]">신청 결과와 다음 행동을 한눈에 확인해요.</p>
      {error && items !== null ? <div aria-live="polite" className="mt-5 rounded-2xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm text-[var(--tm-status-error-text)]">{error}</div> : null}
      {error && items === null ? <LoadError error={error} onRetry={load} /> : items === null ? <CourtRallyLoader className="mt-4" label="신청 내역을 준비하고 있어요." /> : items.length === 0 ? <EmptySentApplications /> : <div className="mt-6 grid gap-4">{items.map((item) => <SentApplicationCard item={item} key={item.id} withdrawing={withdrawingId === item.id} onWithdraw={() => setWithdrawConfirmId(item.id)} />)}</div>}
      {withdrawConfirmId ? <WithdrawalConfirm busy={withdrawingId === withdrawConfirmId} onCancel={() => setWithdrawConfirmId(null)} onConfirm={() => { const applicationId = withdrawConfirmId; setWithdrawConfirmId(null); void withdraw(applicationId); }} /> : null}
    </div>
    <BottomNavigation />
  </main>;
}

function LoadError({ error, onRetry }: { error: string; onRetry: () => Promise<void> }) {
  return <section className="mt-8 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5"><p>{error}</p><button className="mt-4 rounded-2xl bg-[var(--tm-action-primary)] px-4 py-3 text-sm font-semibold text-white" onClick={() => void onRetry()} type="button">다시 불러오기</button></section>;
}

function EmptySentApplications() {
  return <section className="mt-10 rounded-3xl border border-dashed border-[var(--tm-border-strong)] bg-white px-5 py-10 text-center"><p className="text-2xl">🎾</p><h2 className="mt-4 font-bold">아직 보낸 신청이 없어요</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">마음에 드는 매치를 찾아 부담 없이 신청해 보세요.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-[var(--tm-action-primary)] px-4 text-sm font-semibold text-white" href="/">매치 찾아보기</Link></section>;
}

function SentApplicationCard({ item, withdrawing, onWithdraw }: { item: SentApplication; withdrawing: boolean; onWithdraw: () => void }) {
  const active = item.status === "PENDING" || item.status === "ACCEPTED";
  return <article className="rounded-3xl border border-[var(--tm-border-default)] bg-white p-5 shadow-[0_4px_14px_rgba(49,94,158,0.05)]">
    <Link className="block transition-colors hover:text-[var(--tm-action-primary)]" href={`/matches/${item.match.id}?returnTo=${encodeURIComponent("/activity/sent")}`}>
      <div className="flex items-start justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-[var(--tm-bg-subtle)] text-[var(--tm-action-primary)]" : "bg-[var(--tm-bg-subtle-muted)] text-[var(--tm-text-secondary)]"}`}>{item.statusLabel}</span><span className="text-xs text-[var(--tm-text-secondary)]">{appliedDate(item.createdAt)}</span></div>
      <h2 className="mt-4 text-lg font-bold">{item.match.title}</h2>
      <p className="mt-3 text-sm text-[var(--tm-text-muted)]">🗓 {schedule(item.match.startsAt)}</p>
      <p className="mt-1 text-sm text-[var(--tm-text-muted)]">📍 {item.match.courtName ?? "코트는 함께 정해요"} · {item.match.regionName}</p>
      <p className="mt-3 text-sm font-semibold text-[var(--tm-action-primary)]">{item.match.courtSource === "COURT_TBD" ? "코트와 비용을 함께 정해요" : item.match.courtSource === "PARTNER_COURT" ? "Tennis Mate에서 준비한 코트예요" : item.match.estimatedFeePerPersonKrw === null ? "예상 비용을 확인해 주세요" : `예상 1인 약 ${item.match.estimatedFeePerPersonKrw.toLocaleString("ko-KR")}원`}</p>
      {item.supplyNotice ? <p className="mt-4 rounded-2xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--tm-status-error-text)]">{item.supplyNotice.message}</p> : <p className="mt-4 border-t border-[var(--tm-border-subtle)] pt-3 text-sm font-medium leading-6 text-[var(--tm-text-muted)]">{nextStepMessage(item.status, item.match.status)}</p>}
      {item.message ? <p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">“{item.message}”</p> : null}
    </Link>
    {item.contact ? <><p className="mt-4 rounded-2xl bg-[var(--tm-bg-subtle)] px-4 py-3 text-sm leading-6 text-[var(--tm-action-hover)]">{acceptedCoordinationMessage(item.match.courtSource)}</p><a className="mt-3 flex min-h-[52px] items-center justify-center rounded-2xl bg-[var(--tm-action-primary)] px-4 text-center text-sm font-semibold text-white" href={item.contact.url} rel="noreferrer" target="_blank">{item.contact.label}</a></> : null}
    {item.status === "PENDING" ? <button className="mt-3 min-h-11 w-full rounded-2xl border border-[var(--tm-border-default)] px-4 text-sm font-semibold text-[var(--tm-text-muted)] disabled:opacity-50" disabled={withdrawing} onClick={onWithdraw} type="button">신청 철회</button> : null}
  </article>;
}

function WithdrawalConfirm({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end bg-black/35 px-5 pb-[max(20px,env(safe-area-inset-bottom))]" role="presentation"><section aria-label="신청 철회 확인" aria-modal="true" className="mx-auto w-full max-w-[560px] rounded-[28px] bg-[var(--tm-bg-page)] p-5" role="dialog"><p className="text-sm font-semibold text-[var(--tm-action-primary)]">한 번만 확인해요</p><h2 className="mt-2 text-xl font-bold">신청을 철회할까요?</h2><p className="mt-3 text-sm leading-6 text-[var(--tm-text-secondary)]">철회하면 다시 신청하지 못할 수 있어요.</p><div className="mt-6 grid gap-3"><button className="min-h-[52px] w-full rounded-2xl bg-[var(--tm-action-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={onConfirm} type="button">{busy ? "철회하는 중…" : "네, 철회할게요"}</button><button className="min-h-[52px] w-full rounded-2xl border border-[var(--tm-border-default)] px-4 text-sm font-semibold text-[var(--tm-text-muted)]" disabled={busy} onClick={onCancel} type="button">돌아가기</button></div></section></div>;
}
