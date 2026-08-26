"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getSafeReturnTo, getStartAuthCallbackPath } from "@/navigation/return-to";
import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";

type Screen = "loading" | "login" | "error" | "nickname" | 0 | 1 | 2 | 3 | 4 | "result";
type Region = { code: string; name: string; shortName: string | null; parentCode: string | null; parentName?: string | null; type: "CITY" | "DISTRICT" };
type ProfileDraft = {
  nickname: string;
  provinceCode: string;
  regionCode: string;
  regionName: string;
  nearbyRegionAllowed: boolean;
  experienceRange: "UNDER_3_MONTHS" | "MONTHS_3_TO_6" | "MONTHS_6_TO_12" | "YEARS_1_TO_2" | "YEARS_2_PLUS" | "";
  rallyLevel: "STARTING" | "SHORT_RALLY" | "COMFORTABLE_RALLY" | "STANDARD_RALLY" | "";
  gameExperience: "NONE" | "KNOWS_RULES" | "PLAYED_FEW" | "CAN_PLAY" | "";
  playPurposes: Array<"CASUAL_HIT" | "RALLY_PRACTICE" | "STROKE_PRACTICE" | "GAME_INTRO" | "GAME">;
  version: number | null;
};

type MeResponse = {
  nickname: string;
  nicknameConfirmed: boolean;
  onboardingCompleted: boolean;
  tennisProfile: null | {
    experienceRange: ProfileDraft["experienceRange"];
    rallyLevel: ProfileDraft["rallyLevel"];
    gameExperience: ProfileDraft["gameExperience"];
    playPurposes: ProfileDraft["playPurposes"];
    activityRegion: { code: string; name: string; parentCode: string | null } | null;
    nearbyRegionAllowed: boolean;
    version: number;
  };
};

const initialDraft: ProfileDraft = {
  nickname: "",
  provinceCode: "",
  regionCode: "",
  regionName: "",
  nearbyRegionAllowed: true,
  experienceRange: "",
  rallyLevel: "",
  gameExperience: "",
  playPurposes: [],
  version: null,
};

const questions = [
  { key: "region", title: "주로 어디에서\n테니스를 치고 싶나요?", description: "가장 자주 찾을 지역을 골라 주세요." },
  { key: "experienceRange", title: "테니스와 친해진 지\n얼마나 됐나요?", description: "정확하지 않아도 괜찮아요.", options: [
    ["UNDER_3_MONTHS", "3개월 미만", "이제 막 기본 동작을 배우고 있어요"],
    ["MONTHS_3_TO_6", "3~6개월", "공을 맞히는 감각을 익히고 있어요"],
    ["MONTHS_6_TO_12", "6개월~1년", "짧은 랠리를 연습하고 있어요"],
    ["YEARS_1_TO_2", "1~2년", "랠리와 게임을 조금씩 경험했어요"],
    ["YEARS_2_PLUS", "2년 이상", "초보 메이트와 편하게 치고 싶어요"],
  ] },
  { key: "rallyLevel", title: "요즘 랠리는\n어떤가요?", description: "가장 가까운 하나를 골라 주세요.", options: [
    ["STARTING", "아직 랠리가 어려워요", "공을 이어가는 연습을 하고 있어요"],
    ["SHORT_RALLY", "몇 번씩 주고받을 수 있어요", "천천히 치면 짧은 랠리가 가능해요"],
    ["COMFORTABLE_RALLY", "편하게 랠리할 수 있어요", "비슷한 수준끼리는 어느 정도 이어가요"],
    ["STANDARD_RALLY", "일반적인 랠리도 가능해요", "속도가 조금 있어도 주고받을 수 있어요"],
  ] },
  { key: "gameExperience", title: "테니스 게임도\n해봤나요?", description: "게임 실력을 평가하는 질문이 아니에요.", options: [
    ["NONE", "아직 해보지 않았어요", "게임보다 랠리가 편해요"],
    ["KNOWS_RULES", "규칙은 알고 있어요", "점수와 기본 진행 방식을 알아요"],
    ["PLAYED_FEW", "몇 번 해봤어요", "도움을 받으면 게임할 수 있어요"],
    ["CAN_PLAY", "게임을 진행할 수 있어요", "복식 게임을 부담 없이 즐길 수 있어요"],
  ] },
  { key: "playPurposes", title: "요즘 어떤 테니스를\n하고 싶나요?", description: "지금 원하는 플레이를 최대 2개 골라 주세요.", options: [
    ["CASUAL_HIT", "편하게 공 주고받기", "부담 없이 천천히 시작해요"],
    ["RALLY_PRACTICE", "랠리", "공을 길게 이어가고 싶어요"],
    ["STROKE_PRACTICE", "스트로크 연습", "포핸드와 백핸드를 반복해요"],
    ["GAME_INTRO", "게임 입문", "규칙을 익히며 천천히 해봐요"],
    ["GAME", "게임", "실전처럼 점수를 내며 즐겨요"],
  ] },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function responseBody(response: Response) {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = isRecord(body) && isRecord(body.error) && typeof body.error.message === "string"
      ? body.error.message
      : "요청을 처리하지 못했어요. 다시 시도해 주세요.";
    throw new Error(message);
  }
  return body;
}

type M2OnboardingFlowProps = {
  onCompleted?: () => void;
  redirectWhenOnboarded?: boolean;
  returnTo?: string;
  skipTennisProfileOnboarding?: boolean;
};

export function M2OnboardingFlow({ onCompleted, redirectWhenOnboarded = false, returnTo = "/", skipTennisProfileOnboarding = false }: M2OnboardingFlowProps) {
  const router = useRouter();
  const safeReturnTo = getSafeReturnTo(returnTo);
  const [screen, setScreen] = useState<Screen>("loading");
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [searchResults, setSearchResults] = useState<Region[]>([]);
  const [regionQuery, setRegionQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDistricts = async (parentCode: string) => {
    const response = await fetch(`/api/v1/regions?parentCode=${encodeURIComponent(parentCode)}`);
    const body = await responseBody(response) as { items: Region[] };
    setDistricts(body.items);
  };

  useEffect(() => {
    void (async () => {
      try {
        const meResponse = await fetch("/api/v1/me", { cache: "no-store" });
        if (meResponse.status === 401) {
          setScreen("login");
          return;
        }
        const me = await responseBody(meResponse) as MeResponse;
        if (skipTennisProfileOnboarding) {
          router.replace(safeReturnTo);
          return;
        }
        const citiesResponse = await fetch("/api/v1/regions", { cache: "no-store" });
        const cityItems = (await responseBody(citiesResponse) as { items: Region[] }).items;
        setCities(cityItems);
        const profile = me.tennisProfile;
        const provinceCode = profile?.activityRegion?.parentCode ?? cityItems[0]?.code ?? "";
        if (provinceCode) await loadDistricts(provinceCode);
        setDraft({
          nickname: me.nickname,
          provinceCode,
          regionCode: profile?.activityRegion?.code ?? "",
          regionName: profile?.activityRegion?.name ?? "",
          nearbyRegionAllowed: profile?.nearbyRegionAllowed ?? true,
          experienceRange: profile?.experienceRange ?? "",
          rallyLevel: profile?.rallyLevel ?? "",
          gameExperience: profile?.gameExperience ?? "",
          playPurposes: profile?.playPurposes ?? [],
          version: profile?.version ?? null,
        });
        if (me.onboardingCompleted && redirectWhenOnboarded) {
          router.replace(safeReturnTo);
          return;
        }
        setScreen(!me.nicknameConfirmed ? "nickname" : me.onboardingCompleted ? "result" : 0);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "서비스를 불러오지 못했어요.");
        setScreen("error");
      }
    })();
  }, [redirectWhenOnboarded, router, safeReturnTo, skipTennisProfileOnboarding]);

  useEffect(() => {
    const query = regionQuery.trim();
    if (!query) {
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/v1/regions?query=${encodeURIComponent(query)}`);
          const body = await responseBody(response) as { items: Region[] };
          setSearchResults(body.items);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "지역을 불러오지 못했어요.");
        }
      })();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [regionQuery]);

  const displayedDistricts = useMemo(
    () => regionQuery.trim() ? searchResults : districts,
    [districts, regionQuery, searchResults],
  );

  const goBack = () => {
    setError("");
    if (screen === "nickname") setScreen("login");
    else if (typeof screen === "number") setScreen(screen === 0 ? "nickname" : screen - 1 as Screen);
    else if (screen === "result") setScreen(4);
  };

  const saveNickname = async () => {
    setLoading(true); setError("");
    try {
      await responseBody(await fetch("/api/v1/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: draft.nickname }) }));
      setScreen(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "닉네임을 저장하지 못했어요.");
    } finally { setLoading(false); }
  };

  const saveProfile = async () => {
    setLoading(true); setError("");
    try {
      const profile = await responseBody(await fetch("/api/v1/me/tennis-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceRange: draft.experienceRange,
          rallyLevel: draft.rallyLevel,
          gameExperience: draft.gameExperience,
          playPurposes: draft.playPurposes,
          activityRegionCode: draft.regionCode,
          nearbyRegionAllowed: draft.nearbyRegionAllowed,
          expectedVersion: draft.version,
        }),
      })) as { version: number };
      setDraft((current) => ({ ...current, version: profile.version }));
      setScreen("result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "프로필을 저장하지 못했어요.");
    } finally { setLoading(false); }
  };

  const selectCity = async (city: Region) => {
    setDraft((current) => ({ ...current, provinceCode: city.code, regionCode: "", regionName: "" }));
    setRegionQuery("");
    try { await loadDistricts(city.code); } catch (caught) { setError(caught instanceof Error ? caught.message : "지역을 불러오지 못했어요."); }
  };

  const togglePurpose = (purpose: ProfileDraft["playPurposes"][number]) => {
    setError("");
    setDraft((current) => {
      if (current.playPurposes.includes(purpose)) return { ...current, playPurposes: current.playPurposes.filter((item) => item !== purpose) };
      if (current.playPurposes.length >= 2) { setError("최대 2개까지 선택할 수 있어요."); return current; }
      return { ...current, playPurposes: [...current.playPurposes, purpose] };
    });
  };

  if (screen === "loading") return <main className="grid min-h-svh place-items-center bg-[var(--tm-bg-page)] px-5"><CourtRallyLoader className="max-w-[560px]" label="테니스 메이트를 준비하고 있어요." /></main>;

  if (screen === "login") return <LoginScreen loading={loading} onSignIn={() => { setLoading(true); void signIn("kakao", { callbackUrl: skipTennisProfileOnboarding ? safeReturnTo : getStartAuthCallbackPath("PLAYER", safeReturnTo) }); }} />;

  if (screen === "error") return <ServiceCheckError onRetry={() => window.location.reload()} />;

  if (screen === "nickname") {
    const nicknameValid = /^[가-힣a-zA-Z0-9]{2,12}$/.test(draft.nickname.trim());
    return <FormShell step={1} onBack={goBack}><h1>어떤 이름으로<br />불러드릴까요?</h1><p>다른 메이트에게 보이는 닉네임이에요.</p><label className="mt-8 block text-sm font-semibold" htmlFor="nickname">닉네임</label><input className="mt-2 h-[52px] w-full rounded-xl border border-[var(--tm-border-default)] px-4 text-base" id="nickname" maxLength={12} onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))} value={draft.nickname} /><p className="mt-2 text-sm text-[var(--tm-text-secondary)]">2–12자 · 한글, 영문, 숫자를 사용할 수 있어요.</p>{error ? <ErrorMessage message={error} /> : null}<ActionButton disabled={!nicknameValid} loading={loading} onClick={() => void saveNickname()}>이 이름으로 시작할게요</ActionButton></FormShell>;
  }

  if (typeof screen === "number") {
    const question = questions[screen];
    const selected = question.key === "playPurposes" ? draft.playPurposes : draft[question.key as "experienceRange" | "rallyLevel" | "gameExperience"];
    const canContinue = question.key === "region" ? Boolean(draft.regionCode) : Array.isArray(selected) ? selected.length > 0 : Boolean(selected);
    const options = "options" in question ? question.options : [];
    const selectOption = (value: string) => {
      if (question.key === "playPurposes") {
        togglePurpose(value as ProfileDraft["playPurposes"][number]);
        return;
      }
      setDraft((current) => ({
        ...current,
        [question.key]: value,
      }));
    };

    const questionContent = question.key === "region" ? (
      <div className="mt-7">
        <label className="sr-only" htmlFor="region-search">지역 검색</label>
        <input className="h-[48px] w-full rounded-xl border border-[var(--tm-border-default)] px-4" id="region-search" onChange={(event) => setRegionQuery(event.target.value)} placeholder="시·군·구 검색" value={regionQuery} />
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {cities.map((city) => <button className={`shrink-0 rounded-full px-3 py-2 text-sm ${city.code === draft.provinceCode ? "bg-[var(--tm-action-primary)] text-white" : "bg-[var(--tm-bg-subtle-muted)]"}`} key={city.code} onClick={() => void selectCity(city)} type="button">{city.shortName ?? city.name}</button>)}
        </div>
        {draft.regionName ? <p className="mt-4 rounded-xl bg-[var(--tm-bg-subtle)] p-3 text-sm font-semibold text-[var(--tm-action-primary)]">선택한 주 활동 지역 · {draft.regionName}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {displayedDistricts.map((district) => <button aria-pressed={draft.regionCode === district.code} className={`min-h-[44px] rounded-xl border px-3 text-left text-sm ${draft.regionCode === district.code ? "border-[var(--tm-action-primary)] bg-[var(--tm-bg-subtle)] text-[var(--tm-action-primary)]" : "border-[var(--tm-border-default)]"}`} key={district.code} onClick={() => { setDraft((current) => ({ ...current, provinceCode: district.parentCode ?? current.provinceCode, regionCode: district.code, regionName: district.name })); setRegionQuery(""); }} type="button">{district.name}{district.parentName ? <span className="mt-1 block text-xs text-[var(--tm-text-secondary)]">{district.parentName}</span> : null}</button>)}
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm"><input checked={draft.nearbyRegionAllowed} onChange={(event) => setDraft((current) => ({ ...current, nearbyRegionAllowed: event.target.checked }))} type="checkbox" />선택 지역과 가까운 시·군·구도 괜찮아요</label>
      </div>
    ) : (
      <div className="mt-7 space-y-3">
        {options.map(([value, title, description]) => {
          const active = Array.isArray(selected) ? selected.includes(value as never) : selected === value;
          return <button aria-pressed={active} className={`min-h-[72px] w-full rounded-2xl border p-4 text-left ${active ? "border-[var(--tm-action-primary)] bg-[var(--tm-bg-subtle)]" : "border-[var(--tm-border-default)]"}`} key={value} onClick={() => selectOption(value)} type="button"><strong className="block">{title}</strong><span className="mt-1 block text-sm text-[var(--tm-text-secondary)]">{description}</span></button>;
        })}
      </div>
    );

    return <FormShell step={screen + 1} onBack={goBack}><h1>{question.title.split("\n").map((line) => <span key={line}>{line}<br /></span>)}</h1><p>{question.description}</p>{questionContent}{error ? <ErrorMessage message={error} /> : null}<ActionButton disabled={!canContinue} loading={loading} onClick={() => screen === 4 ? void saveProfile() : setScreen((screen + 1) as Screen)}>{screen === 4 ? "프로필 완성하기" : "다음"}</ActionButton></FormShell>;
  }

  return <FormShell step={5} onBack={goBack}><div className="mt-8 grid size-12 place-items-center rounded-full bg-[var(--tm-bg-subtle)] text-2xl text-[var(--tm-action-primary)]">✓</div><h1 className="mt-6">{draft.nickname}님의<br />플레이 프로필이 완성됐어요</h1><p>이 정보를 기준으로 잘 맞는 매치를 먼저 보여드릴게요.</p><div className="mt-8 rounded-2xl bg-[var(--tm-bg-subtle-muted)] p-5"><strong>{draft.nickname}</strong><p className="mt-2 text-sm text-[var(--tm-text-secondary)]">{draft.regionName} · {draft.experienceRange === "YEARS_1_TO_2" ? "1~2년" : "테니스 프로필"}</p></div><ActionButton onClick={() => onCompleted ? onCompleted() : router.replace(safeReturnTo)}>추천 매치 보기</ActionButton>{error ? <ErrorMessage message={error} /> : null}</FormShell>;
}

function LoginScreen({ loading, onSignIn }: { loading: boolean; onSignIn: () => void }) {
  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 py-[72px] text-[var(--tm-text-primary)]"><section className="mx-auto flex min-h-[700px] max-w-[338px] flex-col rounded-[28px] bg-white p-7 shadow-[0_4px_14px_rgba(49,94,158,0.06)]"><p className="font-semibold text-[var(--tm-action-primary)]">● Tennis Mate</p><h1 className="mt-12 text-[32px] font-bold leading-tight">테니스 메이트를<br />가볍게 시작해요</h1><p className="mt-4 leading-7 text-[var(--tm-text-secondary)]">조건이 맞는 메이트를 찾고,<br />신청부터 약속 확인까지 한 번에 이어가세요.</p><section className="mt-20 rounded-2xl bg-[var(--tm-bg-subtle)] p-4"><h2 className="text-sm font-semibold text-[var(--tm-action-primary)]">지금 보던 화면으로 돌아와요</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-muted)]">카카오로 로그인하면 이어서 이용할 수 있어요.</p></section><div className="flex-1" /><button className="min-h-[52px] rounded-2xl bg-[var(--tm-action-primary)] px-4 text-lg font-semibold text-white disabled:opacity-60" disabled={loading} onClick={onSignIn} type="button">카카오 계정으로 시작하기</button><p className="mt-4 text-center text-xs leading-5 text-[var(--tm-text-secondary)]">계속하면 <Link className="font-semibold text-[var(--tm-action-primary)] underline" href="/terms">서비스 이용약관</Link>과<br /><Link className="font-semibold text-[var(--tm-action-primary)] underline" href="/privacy">개인정보 처리방침</Link>에 동의하게 됩니다.</p></section></main>;
}

function ServiceCheckError({ onRetry }: { onRetry: () => void }) {
  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 py-[72px] text-[var(--tm-text-primary)]"><section className="mx-auto flex min-h-[700px] max-w-[338px] flex-col rounded-[28px] bg-white p-7 shadow-[0_4px_14px_rgba(49,94,158,0.06)]"><p className="font-semibold text-[var(--tm-action-primary)]">● Tennis Mate</p><h1 className="mt-12 text-[32px] font-bold leading-tight">서비스를<br />확인하지 못했어요</h1><p className="mt-4 leading-7 text-[var(--tm-text-secondary)]">잠시 네트워크 상태를 확인한 뒤<br />다시 시도해 주세요.</p><section className="mt-20 rounded-2xl bg-[var(--tm-bg-subtle)] p-4"><h2 className="text-sm font-semibold text-[var(--tm-action-primary)]">로그인 정보는 안전하게 유지돼요</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-muted)]">반복되면 운영자에게 알려 주세요.</p></section><div className="flex-1" /><button className="min-h-[52px] rounded-2xl bg-[var(--tm-action-primary)] px-4 text-lg font-semibold text-white" onClick={onRetry} type="button">다시 확인하기</button></section></main>;
}

function FormShell({ children, onBack, step }: { children: React.ReactNode; onBack: () => void; step: number }) {
  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 py-6 text-[var(--tm-text-primary)]"><section className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-[480px] flex-col"><header className="flex items-center gap-4"><button aria-label="이전 화면으로 돌아가기" className="grid size-11 place-items-center rounded-full" onClick={onBack} type="button">←</button><div className="flex-1"><div className="h-1 overflow-hidden rounded-full bg-[var(--tm-border-default)]"><span className="block h-full bg-[var(--tm-action-primary)]" style={{ width: `${step * 20}%` }} /></div><p className="mt-1 text-right text-xs text-[var(--tm-text-secondary)]">{step}/5</p></div></header><div className="pt-8 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:leading-snug [&>p]:mt-3 [&>p]:leading-6 [&>p]:text-[var(--tm-text-secondary)]">{children}</div></section></main>;
}

function ActionButton({ children, disabled, loading, onClick }: { children: React.ReactNode; disabled?: boolean; loading?: boolean; onClick: () => void }) {
  return <button className="mt-6 min-h-[52px] w-full rounded-2xl bg-[var(--tm-action-primary)] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || loading} onClick={onClick} type="button">{loading ? "처리 중…" : children}</button>;
}

function ErrorMessage({ message }: { message: string }) {
  return <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{message}</p>;
}
