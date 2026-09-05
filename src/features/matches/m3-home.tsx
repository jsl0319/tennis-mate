"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";
import { Button } from "@/components/ui/button";
import { getSafeReturnTo } from "@/navigation/return-to";
import { EntrySelection } from "@/features/profile/entry-selection";
import { M2OnboardingFlow } from "@/features/profile/m2-onboarding-flow";

import { MatchCard, type MatchCardData } from "./m3-match-card";

type MeResponse = {
  nickname: string;
  onboardingCompleted: boolean;
  tennisProfile: null | { rallyLevel: string };
};

type MatchListResponse = { items: MatchCardData[] };
type Screen = "loading" | "entry" | "onboarding" | "home" | "error";
type MatchList = "recommended" | "other";

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

export function RallyOnHome({ returnTo = "/" }: { returnTo?: string }) {
  const safeReturnTo = getSafeReturnTo(returnTo);
  const [screen, setScreen] = useState<Screen>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [recommended, setRecommended] = useState<MatchCardData[]>([]);
  const [matches, setMatches] = useState<MatchCardData[]>([]);
  const [error, setError] = useState("");
  const [activeList, setActiveList] = useState<MatchList>("recommended");

  const load = useCallback(async () => {
    try {
      const meResponse = await fetch("/api/v1/me", { cache: "no-store" });
      if (meResponse.status === 401) {
        setScreen("entry");
        return;
      }
      const meBody: unknown = await meResponse.json();
      if (!meResponse.ok) throw new Error(getErrorMessage(meBody));
      const current = meBody as MeResponse;
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
  if (screen === "entry") return <EntrySelection returnTo={safeReturnTo} />;
  if (screen === "onboarding") return <M2OnboardingFlow returnTo={safeReturnTo} />;
  if (screen === "error") return <HomeStateFrame><div><p className="text-lg font-bold">불러오지 못했어요</p><p className="mt-2 text-sm text-[var(--tm-text-secondary)]">{error}</p><Button className="mt-6" onClick={() => void load()}>다시 불러오기</Button></div></HomeStateFrame>;

  const visibleOtherMatches = matches.filter((match) => !recommended.some((item) => item.id === match.id));
  const isRecommendedList = activeList === "recommended";
  const activeMatches = isRecommendedList ? recommended : visibleOtherMatches;
  const listTitle = isRecommendedList ? "나와 잘 맞을 것 같아요 🎾" : "다른 매칭 둘러보기";
  const listDescription = isRecommendedList
    ? "랠리 수준과 원하는 플레이를 기준으로 골랐어요."
    : "추천 조건과 달라도, 지금 함께 칠 수 있는 매칭이에요.";

  return (
    <main className="min-h-svh bg-[var(--tm-bg-page)] pb-28 text-[var(--tm-text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[var(--tm-border-default)] bg-[var(--tm-bg-page)] backdrop-blur">
        <div className="mx-auto max-w-[560px] px-5 pb-4 pt-8">
          <p className="text-sm font-semibold text-[var(--tm-action-primary)]">Rally On</p>
          <h1 className="mt-3 text-2xl font-bold leading-snug">{me?.nickname}님, 오늘도<br />부담 없이 테니스해요.</h1>

          <div aria-label="매칭 목록 선택" className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--tm-bg-subtle)] p-1" role="group">
            <ListTab active={isRecommendedList} label="추천 매칭" onClick={() => setActiveList("recommended")} />
            <ListTab active={!isRecommendedList} label="다른 매칭" onClick={() => setActiveList("other")} />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[560px] px-5 pt-6">
        <h2 className="text-xl font-bold">{listTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">{listDescription}</p>
        <Link className="mt-4 flex min-h-12 items-center justify-between rounded-2xl border border-[var(--tm-border-default)] bg-white px-4 text-sm font-semibold text-[var(--tm-action-primary)]" href="/partner-sessions"><span>코트 걱정 없이 함께 테니스해요</span><span aria-hidden>→</span></Link>
        {activeMatches.length > 0 ? (
          <div className="mt-4 grid gap-4">{activeMatches.map((match) => <MatchCard key={match.id} match={match} />)}</div>
        ) : isRecommendedList && visibleOtherMatches.length > 0 ? (
          <EmptyRecommendedState onShowOtherMatches={() => setActiveList("other")} />
        ) : isRecommendedList ? (
          <EmptyMatchState />
        ) : (
          <p className="mt-4 rounded-3xl bg-[var(--tm-bg-subtle)] p-5 text-sm leading-6 text-[var(--tm-text-secondary)]">지금은 추천 매칭이 전부예요. 나와 잘 맞는 매칭을 다시 확인해 보세요.</p>
        )}
      </section>

      <Link aria-label="매칭 만들기" className="fixed bottom-24 right-5 z-30 inline-flex min-h-[52px] items-center gap-2 rounded-full bg-[var(--tm-action-primary)] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(49,94,158,0.26)] transition-transform active:scale-95" href="/matches/new">
        <span aria-hidden="true" className="text-lg leading-none text-[var(--tm-tennis-ball)]">+</span>
        매칭 만들기
      </Link>
      <BottomNavigation />
    </main>
  );
}

function ListTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button aria-pressed={active} className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors ${active ? "bg-[var(--tm-action-primary)] text-white shadow-sm" : "text-[var(--tm-text-secondary)]"}`} onClick={onClick} type="button">{label}</button>;
}

function EmptyRecommendedState({ onShowOtherMatches }: { onShowOtherMatches: () => void }) {
  return <div className="mt-4 rounded-3xl bg-[var(--tm-bg-subtle)] p-5"><p className="font-bold">조건이 꼭 맞는 매칭은 아직 없어요.</p><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">다른 초보자 매칭도 편하게 둘러볼 수 있어요.</p><button className="mt-4 text-sm font-semibold text-[var(--tm-action-primary)] underline" onClick={onShowOtherMatches} type="button">다른 매칭 보기</button></div>;
}

function EmptyMatchState() {
  return <div className="mt-4 rounded-3xl bg-[var(--tm-bg-subtle)] p-6"><p className="font-bold">아직 둘러볼 매칭이 없어요.</p><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">새로운 매칭이 등록되면 여기에서 확인할 수 있어요.</p><Link className="mt-4 inline-block text-sm font-semibold text-[var(--tm-action-primary)] underline" href="/matches/new">매칭 만들기</Link></div>;
}

function HomeLoading() {
  return <HomeStateFrame><CourtRallyLoader className="max-w-[560px]" label="매칭을 준비하고 있어요." /></HomeStateFrame>;
}

function HomeStateFrame({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-svh flex-col bg-[var(--tm-bg-page)] pb-32 text-[var(--tm-text-primary)]">
    <header className="border-b border-[var(--tm-border-default)] bg-[var(--tm-bg-page)]">
      <div className="mx-auto max-w-[560px] px-5 pb-5 pt-8"><p className="text-sm font-semibold text-[var(--tm-action-primary)]">Rally On</p><h1 className="mt-2 text-2xl font-bold">매칭</h1><p className="mt-3 text-sm leading-6 text-[var(--tm-text-secondary)]">함께 칠 메이트를 찾고 있어요.</p></div>
    </header>
    <section className="mx-auto flex w-full max-w-[560px] flex-1 items-center justify-center px-5 text-center">{children}</section>
    <BottomNavigation />
  </main>;
}
