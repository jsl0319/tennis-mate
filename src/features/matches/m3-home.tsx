"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { M2OnboardingFlow } from "@/features/profile/m2-onboarding-flow";

import { MatchCard, MatchCardSkeleton, type MatchCardData } from "./m3-match-card";

type MeResponse = {
  nickname: string;
  onboardingCompleted: boolean;
  tennisProfile: null | { activityRegion: { name: string } | null; rallyLevel: string };
};

type MatchListResponse = { items: MatchCardData[] };
type Screen = "loading" | "onboarding" | "home" | "error";

function getErrorMessage(body: unknown) {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  }
  return "매칭을 불러오지 못했어요. 다시 시도해 주세요.";
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(body));
  return body as T;
}

export function TennisMateHome() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [recommended, setRecommended] = useState<MatchCardData[]>([]);
  const [matches, setMatches] = useState<MatchCardData[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const current = await requestJson<MeResponse>("/api/v1/me");
      setMe(current);
      if (!current.onboardingCompleted) {
        setScreen("onboarding");
        return;
      }
      const [recommendedResponse, matchesResponse] = await Promise.all([
        requestJson<MatchListResponse>("/api/v1/matches/recommended?limit=5"),
        requestJson<MatchListResponse>("/api/v1/matches?limit=20"),
      ]);
      setRecommended(recommendedResponse.items);
      setMatches(matchesResponse.items);
      setScreen("home");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "서비스를 불러오지 못했어요.");
      setScreen("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (screen === "loading") return <HomeLoading />;
  if (screen === "onboarding") return <M2OnboardingFlow onCompleted={() => void load()} />;
  if (screen === "error") return <main className="grid min-h-svh place-items-center bg-[#fffdfc] px-5 text-center"><div><p className="text-lg font-bold">불러오지 못했어요</p><p className="mt-2 text-sm text-[#5c6b63]">{error}</p><button className="mt-6 rounded-2xl bg-[#1f7a55] px-5 py-3 font-semibold text-white" onClick={() => void load()} type="button">다시 불러오기</button></div></main>;

  const visibleOtherMatches = matches.filter((match) => !recommended.some((item) => item.id === match.id));
  return (
    <main className="min-h-svh bg-[#fffdfc] px-5 pb-12 pt-8 text-[#1a221e]">
      <section className="mx-auto max-w-[560px]">
        <p className="text-sm font-semibold text-[#1f7a55]">Tennis Mate</p>
        <h1 className="mt-3 text-2xl font-bold leading-snug">{me?.nickname}님, 오늘도<br />부담 없이 테니스해요.</h1>
        <p className="mt-3 inline-flex rounded-full bg-[#f0f5f2] px-3 py-2 text-sm text-[#405047]">📍 {me?.tennisProfile?.activityRegion?.name ?? "활동 지역"}에서 메이트를 찾고 있어요</p>

        <section className="mt-9">
          <h2 className="text-xl font-bold">나와 잘 맞을 것 같아요 🎾</h2>
          <p className="mt-2 text-sm leading-6 text-[#5c6b63]">랠리, 원하는 플레이와 활동 지역을 기준으로 골랐어요.</p>
          {recommended.length > 0 ? <div className="mt-4 grid gap-6">{recommended.map((match) => <MatchCard key={match.id} match={match} />)}</div> : <p className="mt-4 rounded-3xl bg-[#f4f7f5] p-5 text-sm leading-6 text-[#405047]">조건이 꼭 맞는 매칭은 아직 없어요. 다른 초보자 매칭도 편하게 둘러보세요.</p>}
        </section>

        <Link className="mt-6 block rounded-3xl bg-[#1f7a55] p-5 text-white" href="/matches/new"><strong>이미 예약한 코트가 있나요?</strong><span className="mt-1 block text-sm opacity-85">편하게 함께 칠 메이트를 모집해보세요.</span></Link>
        <section className="mt-10">
          <h2 className="text-xl font-bold">다른 매칭 둘러보기</h2>
          {visibleOtherMatches.length > 0 ? <div className="mt-4 grid gap-6">{visibleOtherMatches.map((match) => <MatchCard key={match.id} match={match} />)}</div> : recommended.length > 0 ? <p className="mt-4 text-sm text-[#5c6b63]">지금은 추천 매칭이 전부예요.</p> : <EmptyMatchState />}
        </section>
      </section>
    </main>
  );
}

function EmptyMatchState() {
  return <div className="mt-4 rounded-3xl bg-[#f4f7f5] p-6"><p className="font-bold">아직 가까운 매칭이 없어요.</p><p className="mt-2 text-sm leading-6 text-[#5c6b63]">이미 예약한 코트가 있다면 먼저 편하게 모집해볼 수 있어요.</p><Link className="mt-4 inline-block text-sm font-semibold text-[#1f7a55] underline" href="/matches/new">매칭 만들기</Link></div>;
}

function HomeLoading() {
  return <main className="min-h-svh bg-[#fffdfc] px-5 pt-8"><section className="mx-auto max-w-[560px]"><div className="h-4 w-24 animate-pulse rounded bg-[#eaf0ec]" /><div className="mt-4 h-16 w-64 animate-pulse rounded bg-[#eaf0ec]" /><div className="mt-10"><div className="h-6 w-52 animate-pulse rounded bg-[#eaf0ec]" /><div className="mt-4 grid gap-6"><MatchCardSkeleton /><MatchCardSkeleton /></div></div></section></main>;
}
