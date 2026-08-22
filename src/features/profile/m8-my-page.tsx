"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BottomNavigation } from "@/components/navigation/bottom-navigation";

type Me = { nickname: string; tennisProfile: null | { experienceRange: string; rallyLevel: string; gameExperience: string; playPurposes: string[]; activityRegion: { name: string } | null } };

const experienceLabels: Record<string, string> = { UNDER_3_MONTHS: "3개월 미만", MONTHS_3_TO_6: "3~6개월", MONTHS_6_TO_12: "6개월~1년", YEARS_1_TO_2: "1~2년", YEARS_2_PLUS: "2년 이상" };
const rallyLabels: Record<string, string> = { STARTING: "아직 랠리가 어려워요", SHORT_RALLY: "몇 번씩 주고받을 수 있어요", COMFORTABLE_RALLY: "편하게 랠리할 수 있어요", STANDARD_RALLY: "일반적인 랠리도 가능해요" };
const gameLabels: Record<string, string> = { NONE: "아직 해보지 않았어요", KNOWS_RULES: "규칙은 알고 있어요", PLAYED_FEW: "몇 번 해봤어요", CAN_PLAY: "게임을 진행할 수 있어요" };
const purposeLabels: Record<string, string> = { CASUAL_HIT: "편하게 공 주고받기", RALLY_PRACTICE: "랠리", STROKE_PRACTICE: "스트로크 연습", GAME_INTRO: "게임 입문", GAME: "게임" };

function getErrorMessage(body: unknown) {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string" ? body.error.message : "내 정보를 불러오지 못했어요.";
}

export function M8MyPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/v1/me", { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));
      setMe(body as Me);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "내 정보를 불러오지 못했어요."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  return <main className="min-h-svh bg-[#fffdfc] px-5 pb-28 pt-8 text-[#1a221e]"><section className="mx-auto max-w-[560px]"><p className="text-sm font-semibold text-[#1f7a55]">마이</p><h1 className="mt-1 text-2xl font-bold">내 테니스 이야기</h1>{me === null ? error ? <section className="mt-8 rounded-3xl border border-[#d8e0db] bg-white p-5"><p className="text-sm leading-6">{error}</p><button className="mt-4 min-h-11 rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white" onClick={() => void load()} type="button">다시 불러오기</button></section> : <p className="mt-12 text-center text-sm text-[#5c6b63]">내 정보를 불러오는 중이에요…</p> : <><section className="mt-6 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-[0_4px_14px_rgba(23,67,45,0.05)]"><p className="text-sm font-semibold text-[#1f7a55]">{me.nickname}님의 테니스 프로필</p>{me.tennisProfile ? <><h2 className="mt-3 text-xl font-bold">{rallyLabels[me.tennisProfile.rallyLevel]}</h2><p className="mt-2 text-sm leading-6 text-[#5c6b63]">{experienceLabels[me.tennisProfile.experienceRange]} · {gameLabels[me.tennisProfile.gameExperience]}</p><p className="mt-2 text-sm leading-6 text-[#5c6b63]">📍 {me.tennisProfile.activityRegion?.name ?? "활동 지역"} · {me.tennisProfile.playPurposes.map((purpose) => purposeLabels[purpose]).filter(Boolean).join(" · ")}</p></> : <><h2 className="mt-3 text-xl font-bold">테니스 프로필을 만들어 볼까요?</h2><p className="mt-2 text-sm leading-6 text-[#5c6b63]">내게 잘 맞는 메이트를 찾기 위한 정보예요.</p></>}<Link className="mt-5 flex min-h-[52px] items-center justify-between rounded-2xl border border-[#9fc9b1] px-4 text-sm font-semibold text-[#1f7a55]" href={me.tennisProfile ? "/my/profile" : "/"}><span>{me.tennisProfile ? "테니스 프로필 수정" : "테니스 프로필 만들기"}</span><span aria-hidden="true">→</span></Link></section><section className="mt-4 rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-[0_4px_14px_rgba(23,67,45,0.05)]"><h2 className="font-bold">내 활동</h2><p className="mt-2 text-sm leading-6 text-[#5c6b63]">받은 신청과 보낸 신청, 내가 만든 매칭을 한곳에서 확인해요.</p><Link className="mt-4 flex min-h-[52px] items-center justify-center rounded-2xl bg-[#1f7a55] px-4 text-sm font-semibold text-white" href="/activity/received">내 활동 보기</Link></section></>}</section><BottomNavigation /></main>;
}
