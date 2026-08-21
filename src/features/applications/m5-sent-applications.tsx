"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BottomNavigation } from "@/components/navigation/bottom-navigation";

type SentApplication = {
  id: string;
  status: string;
  statusLabel: string;
  message: string | null;
  match: { id: string; title: string; startsAt: string; courtName: string | null; regionName: string; estimatedFeePerPersonKrw: number | null };
  contact: { type: "KAKAO_OPEN_CHAT"; url: string; label: string } | null;
  createdAt: string;
};

function schedule(startsAt: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(startsAt));
}

function appliedDate(createdAt: string) {
  return `신청한 ${new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(createdAt))}`;
}

function nextStepMessage(status: string) {
  return ({
    PENDING: "모집자가 프로필을 확인하고 있어요.",
    ACCEPTED: "같이 치게 됐어요. 매칭 정보를 확인해 주세요.",
    REJECTED: "이번에는 함께하기 어려워요. 다른 추천 매치를 찾아볼 수 있어요.",
    WITHDRAWN: "신청을 철회했어요.",
    CANCELLED: "매칭이 마감되었거나 성사 없이 종료됐어요.",
  } as Record<string, string>)[status] ?? "매칭 상태를 확인해 주세요.";
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

  return <main className="min-h-svh bg-[#fffdfc] px-5 pb-28 pt-6 text-[#1a221e]">
    <div className="mx-auto max-w-[560px]">
      <Link aria-label="홈으로 돌아가기" className="inline-flex size-11 items-center justify-center rounded-full text-xl" href="/">←</Link>
      <p className="mt-5 text-sm font-semibold text-[#1f7a55]">같이 치기</p>
      <h1 className="mt-1 text-2xl font-bold">보낸 신청</h1>
      <p className="mt-2 text-sm leading-6 text-[#5c6b63]">모집자의 확인을 기다리고 있어요.</p>
      {error && items !== null ? <div aria-live="polite" className="mt-5 rounded-2xl bg-[#fff1ef] px-4 py-3 text-sm text-[#a13d32]">{error}</div> : null}
      {error && items === null ? <LoadError error={error} onRetry={load} /> : items === null ? <p className="mt-12 text-center text-sm text-[#5c6b63]">신청 내역을 불러오는 중이에요…</p> : items.length === 0 ? <EmptySentApplications /> : <div className="mt-7 grid gap-4">{items.map((item) => <SentApplicationCard item={item} key={item.id} withdrawing={withdrawingId === item.id} onWithdraw={() => setWithdrawConfirmId(item.id)} />)}</div>}
      {withdrawConfirmId ? <WithdrawalConfirm busy={withdrawingId === withdrawConfirmId} onCancel={() => setWithdrawConfirmId(null)} onConfirm={() => { const applicationId = withdrawConfirmId; setWithdrawConfirmId(null); void withdraw(applicationId); }} /> : null}
    </div>
    <BottomNavigation />
  </main>;
}

function LoadError({ error, onRetry }: { error: string; onRetry: () => Promise<void> }) {
  return <section className="mt-8 rounded-3xl border border-[#d8e0db] bg-white p-5"><p>{error}</p><button className="mt-4 rounded-2xl bg-[#1f7a55] px-4 py-3 text-sm font-semibold text-white" onClick={() => void onRetry()} type="button">다시 불러오기</button></section>;
}

function EmptySentApplications() {
  return <section className="mt-10 rounded-3xl border border-dashed border-[#c7d6ce] bg-white px-5 py-10 text-center"><p className="text-2xl">🎾</p><h2 className="mt-4 font-bold">아직 보낸 신청이 없어요</h2><p className="mt-2 text-sm leading-6 text-[#5c6b63]">마음에 드는 매치를 찾아 부담 없이 신청해 보세요.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white" href="/">매치 찾아보기</Link></section>;
}

function SentApplicationCard({ item, withdrawing, onWithdraw }: { item: SentApplication; withdrawing: boolean; onWithdraw: () => void }) {
  const active = item.status === "PENDING" || item.status === "ACCEPTED";
  return <article className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-[0_4px_14px_rgba(23,67,45,0.05)]">
    <Link className="block transition-colors hover:text-[#1f7a55]" href={`/matches/${item.match.id}`}>
      <div className="flex items-start justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-[#eff9f4] text-[#1f7a55]" : "bg-[#f3f5f4] text-[#5c6b63]"}`}>{item.statusLabel}</span><span className="text-xs text-[#5c6b63]">{appliedDate(item.createdAt)}</span></div>
      <h2 className="mt-4 text-lg font-bold">{item.match.title}</h2>
      <p className="mt-3 text-sm text-[#405047]">🗓 {schedule(item.match.startsAt)}</p>
      <p className="mt-1 text-sm text-[#405047]">📍 {item.match.courtName ?? "코트는 함께 정해요"} · {item.match.regionName}</p>
      <p className="mt-3 text-sm font-semibold text-[#1f7a55]">{item.match.estimatedFeePerPersonKrw === null ? "코트와 비용을 함께 정해요" : `예상 1인 약 ${item.match.estimatedFeePerPersonKrw.toLocaleString("ko-KR")}원`}</p>
      <p className="mt-4 border-t border-[#edf0ee] pt-3 text-sm font-medium leading-6 text-[#405047]">{nextStepMessage(item.status)}</p>
      {item.message ? <p className="mt-2 text-sm leading-6 text-[#5c6b63]">“{item.message}”</p> : null}
    </Link>
    {item.contact ? <><p className="mt-4 rounded-2xl bg-[#eff9f4] px-4 py-3 text-sm leading-6 text-[#315b45]">수락된 참가자끼리 오픈채팅에서 코트와 비용을 조율해요.</p><a className="mt-3 flex min-h-[52px] items-center justify-center rounded-2xl bg-[#1f7a55] px-4 text-center text-sm font-semibold text-white" href={item.contact.url} rel="noreferrer" target="_blank">{item.contact.label}</a></> : null}
    {item.status === "PENDING" ? <button className="mt-3 min-h-11 w-full rounded-2xl border border-[#d8e0db] px-4 text-sm font-semibold text-[#405047] disabled:opacity-50" disabled={withdrawing} onClick={onWithdraw} type="button">신청 철회</button> : null}
  </article>;
}

function WithdrawalConfirm({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end bg-black/35 px-5 pb-[max(20px,env(safe-area-inset-bottom))]" role="presentation"><section aria-label="신청 철회 확인" aria-modal="true" className="mx-auto w-full max-w-[560px] rounded-[28px] bg-[#fffdfc] p-5" role="dialog"><p className="text-sm font-semibold text-[#1f7a55]">한 번만 확인해요</p><h2 className="mt-2 text-xl font-bold">신청을 철회할까요?</h2><p className="mt-3 text-sm leading-6 text-[#5c6b63]">철회하면 다시 신청하지 못할 수 있어요.</p><div className="mt-6 grid gap-3"><button className="min-h-[52px] w-full rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={onConfirm} type="button">{busy ? "철회하는 중…" : "네, 철회할게요"}</button><button className="min-h-[52px] w-full rounded-2xl border border-[#d8e0db] px-4 text-sm font-semibold text-[#405047]" disabled={busy} onClick={onCancel} type="button">돌아가기</button></div></section></div>;
}
