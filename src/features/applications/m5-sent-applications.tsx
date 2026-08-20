"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SentApplication = {
  id: string;
  status: string;
  statusLabel: string;
  message: string | null;
  match: { id: string; title: string; startsAt: string; courtName: string; regionName: string; estimatedFeePerPersonKrw: number };
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

export function M5SentApplications() {
  const [items, setItems] = useState<SentApplication[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/v1/me/applications", { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string" ? body.error.message : "신청 내역을 불러오지 못했어요.");
      setItems((body as { items: SentApplication[] }).items);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "신청 내역을 불러오지 못했어요."); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <main className="min-h-svh bg-[#fffdfc] px-5 pb-10 pt-6 text-[#1a221e]"><div className="mx-auto max-w-[560px]"><Link aria-label="홈으로 돌아가기" className="inline-flex size-11 items-center justify-center rounded-full text-xl" href="/">←</Link><p className="mt-5 text-sm font-semibold text-[#1f7a55]">같이 치기</p><h1 className="mt-1 text-2xl font-bold">보낸 신청</h1><p className="mt-2 text-sm leading-6 text-[#5c6b63]">모집자의 확인을 기다리고 있어요.</p>
    {error ? <div className="mt-8 rounded-3xl border border-[#d8e0db] bg-white p-5"><p>{error}</p><button className="mt-4 rounded-2xl bg-[#1f7a55] px-4 py-3 text-sm font-semibold text-white" onClick={() => void load()} type="button">다시 불러오기</button></div> : items === null ? <p className="mt-12 text-center text-sm text-[#5c6b63]">신청 내역을 불러오는 중이에요…</p> : items.length === 0 ? <section className="mt-10 rounded-3xl border border-dashed border-[#c7d6ce] bg-white px-5 py-10 text-center"><p className="text-2xl">🎾</p><h2 className="mt-4 font-bold">아직 보낸 신청이 없어요</h2><p className="mt-2 text-sm leading-6 text-[#5c6b63]">마음에 드는 매치를 찾아 부담 없이 신청해 보세요.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white" href="/">매치 찾아보기</Link></section> : <div className="mt-7 space-y-3">{items.map((item) => <Link className="block rounded-3xl border border-[#d8e0db] bg-white p-5 transition-colors hover:border-[#9fc9b1]" href={`/matches/${item.match.id}`} key={item.id}><div className="flex items-start justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "PENDING" ? "bg-[#eff9f4] text-[#1f7a55]" : "bg-[#f3f5f4] text-[#5c6b63]"}`}>{item.statusLabel}</span><span className="text-xs text-[#5c6b63]">{appliedDate(item.createdAt)}</span></div><h2 className="mt-4 text-lg font-bold">{item.match.title}</h2><p className="mt-3 text-sm text-[#405047]">🗓 {schedule(item.match.startsAt)}</p><p className="mt-1 text-sm text-[#405047]">📍 {item.match.courtName} · {item.match.regionName}</p><p className="mt-3 text-sm font-semibold text-[#1f7a55]">예상 1인 약 {item.match.estimatedFeePerPersonKrw.toLocaleString("ko-KR")}원</p><p className="mt-4 border-t border-[#edf0ee] pt-3 text-sm font-medium leading-6 text-[#405047]">{nextStepMessage(item.status)}</p>{item.message ? <p className="mt-2 text-sm leading-6 text-[#5c6b63]">“{item.message}”</p> : null}</Link>)}</div>}
  </div></main>;
}
