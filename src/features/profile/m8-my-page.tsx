"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";

type Me = {
  nickname: string;
  tennisProfile: null | {
    experienceRange: string;
    rallyLevel: string;
    gameExperience: string;
    playPurposes: string[];
    activityRegion: { name: string } | null;
  };
};

const experienceLabels: Record<string, string> = { UNDER_3_MONTHS: "3개월 미만", MONTHS_3_TO_6: "3~6개월", MONTHS_6_TO_12: "6개월~1년", YEARS_1_TO_2: "1~2년", YEARS_2_PLUS: "2년 이상" };
const rallyLabels: Record<string, string> = { STARTING: "아직 랠리가 어려워요", SHORT_RALLY: "몇 번씩 주고받을 수 있어요", COMFORTABLE_RALLY: "편하게 랠리할 수 있어요", STANDARD_RALLY: "일반적인 랠리도 가능해요" };
const gameLabels: Record<string, string> = { NONE: "아직 해보지 않았어요", KNOWS_RULES: "규칙은 알고 있어요", PLAYED_FEW: "몇 번 해봤어요", CAN_PLAY: "게임을 진행할 수 있어요" };
const purposeLabels: Record<string, string> = { CASUAL_HIT: "편하게 공 주고받기", RALLY_PRACTICE: "랠리", STROKE_PRACTICE: "스트로크 연습", GAME_INTRO: "게임 입문", GAME: "게임" };

function getErrorMessage(body: unknown, fallback = "내 정보를 불러오지 못했어요.") {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string" ? body.error.message : fallback;
}

function isValidNickname(value: string) {
  return /^[가-힣a-zA-Z0-9]{2,12}$/.test(value.trim());
}

export function M8MyPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/v1/me", { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body));
      const current = body as Me;
      setMe(current);
      setNicknameDraft(current.nickname);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "내 정보를 불러오지 못했어요.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const saveNickname = async () => {
    const nickname = nicknameDraft.trim();
    if (!isValidNickname(nickname)) {
      setNicknameError("2–12자 한글, 영문, 숫자로 입력해 주세요.");
      return;
    }

    setSavingNickname(true);
    setNicknameError("");
    try {
      const response = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(body, "닉네임을 저장하지 못했어요."));
      setMe((current) => current ? { ...current, nickname: (body as { nickname: string }).nickname } : current);
      setEditingNickname(false);
    } catch (caught) {
      setNicknameError(caught instanceof Error ? caught.message : "닉네임을 저장하지 못했어요.");
    } finally {
      setSavingNickname(false);
    }
  };

  const cancelNicknameEdit = () => {
    setNicknameDraft(me?.nickname ?? "");
    setNicknameError("");
    setEditingNickname(false);
  };

  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 pb-28 pt-8 text-[var(--tm-text-primary)]">
    <section className="mx-auto max-w-[560px]">
      <p className="text-sm font-semibold text-[var(--tm-action-primary)]">마이</p>
      <h1 className="mt-1 text-2xl font-bold">내 테니스 이야기</h1>
      {me === null ? error ? <LoadError error={error} onRetry={load} /> : <CourtRallyLoader className="mt-4" label="내 정보를 준비하고 있어요." /> : <>
        <ProfileCard me={me} />
        <ActivityCard />
        <AccountCard
          editingNickname={editingNickname}
          nicknameDraft={nicknameDraft}
          nicknameError={nicknameError}
          nickname={me.nickname}
          savingNickname={savingNickname}
          onCancelEdit={cancelNicknameEdit}
          onChangeNickname={(value) => { setNicknameDraft(value); setNicknameError(""); }}
          onEditNickname={() => setEditingNickname(true)}
          onSaveNickname={() => void saveNickname()}
        />
      </>}
    </section>
    <BottomNavigation />
  </main>;
}

function LoadError({ error, onRetry }: { error: string; onRetry: () => Promise<void> }) {
  return <section className="mt-8 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5"><p className="text-sm leading-6">{error}</p><button className="mt-4 min-h-11 rounded-2xl bg-[var(--tm-action-primary)] px-4 text-sm font-semibold text-white" onClick={() => void onRetry()} type="button">다시 불러오기</button></section>;
}

function ProfileCard({ me }: { me: Me }) {
  return <section className="mt-6 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5 shadow-[0_4px_14px_rgba(49,94,158,0.05)]">
    <p className="text-sm font-semibold text-[var(--tm-action-primary)]">{me.nickname}님의 테니스 프로필</p>
    {me.tennisProfile ? <><h2 className="mt-3 text-xl font-bold">{rallyLabels[me.tennisProfile.rallyLevel]}</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">{experienceLabels[me.tennisProfile.experienceRange]} · {gameLabels[me.tennisProfile.gameExperience]}</p><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">📍 {me.tennisProfile.activityRegion?.name ?? "활동 지역"} · {me.tennisProfile.playPurposes.map((purpose) => purposeLabels[purpose]).filter(Boolean).join(" · ")}</p></> : <><h2 className="mt-3 text-xl font-bold">테니스 프로필을 만들어 볼까요?</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">내게 잘 맞는 메이트를 찾기 위한 정보예요.</p></>}
    <Link className="mt-5 flex min-h-[52px] items-center justify-between rounded-2xl border border-[var(--tm-border-strong)] px-4 text-sm font-semibold text-[var(--tm-action-primary)]" href={me.tennisProfile ? "/my/profile" : "/"}><span>{me.tennisProfile ? "테니스 프로필 수정" : "테니스 프로필 만들기"}</span><span aria-hidden="true">→</span></Link>
  </section>;
}

function ActivityCard() {
  return <section className="mt-4 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5 shadow-[0_4px_14px_rgba(49,94,158,0.05)]"><h2 className="font-bold">내 활동</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">받은 신청과 보낸 신청, 내가 만든 매칭을 한곳에서 확인해요.</p><Link className="mt-4 flex min-h-[52px] items-center justify-center rounded-2xl bg-[var(--tm-action-primary)] px-4 text-sm font-semibold text-white" href="/activity/received">내 활동 보기</Link></section>;
}

function AccountCard({ editingNickname, nicknameDraft, nicknameError, nickname, savingNickname, onCancelEdit, onChangeNickname, onEditNickname, onSaveNickname }: { editingNickname: boolean; nicknameDraft: string; nicknameError: string; nickname: string; savingNickname: boolean; onCancelEdit: () => void; onChangeNickname: (value: string) => void; onEditNickname: () => void; onSaveNickname: () => void }) {
  return <section className="mt-4 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5 shadow-[0_4px_14px_rgba(49,94,158,0.05)]">
    <h2 className="font-bold">계정과 안내</h2>
    {editingNickname ? <div className="mt-4"><label className="block text-sm font-semibold" htmlFor="my-nickname">닉네임</label><input className="mt-2 h-12 w-full rounded-xl border border-[var(--tm-border-default)] px-3" id="my-nickname" maxLength={12} onChange={(event) => onChangeNickname(event.target.value)} value={nicknameDraft} />{nicknameError ? <p className="mt-2 text-sm text-[var(--tm-status-error-text)]" role="alert">{nicknameError}</p> : <p className="mt-2 text-sm text-[var(--tm-text-secondary)]">2–12자 · 한글, 영문, 숫자를 사용할 수 있어요.</p>}<div className="mt-3 grid grid-cols-2 gap-3"><button className="min-h-11 rounded-2xl border border-[var(--tm-border-default)] px-3 text-sm font-semibold text-[var(--tm-text-muted)]" disabled={savingNickname} onClick={onCancelEdit} type="button">취소</button><button className="min-h-11 rounded-2xl bg-[var(--tm-action-primary)] px-3 text-sm font-semibold text-white disabled:opacity-50" disabled={savingNickname} onClick={onSaveNickname} type="button">{savingNickname ? "저장 중…" : "저장"}</button></div></div> : <div className="mt-4 flex items-center justify-between gap-3"><div><p className="text-sm text-[var(--tm-text-secondary)]">닉네임</p><p className="mt-1 font-semibold">{nickname}</p></div><button className="min-h-11 rounded-2xl px-3 text-sm font-semibold text-[var(--tm-action-primary)]" onClick={onEditNickname} type="button">수정</button></div>}
    <div className="mt-5 border-t border-[var(--tm-border-subtle)] pt-2"><Link className="flex min-h-11 items-center text-sm text-[var(--tm-text-muted)]" href="/terms">서비스 이용약관 <span className="ml-auto" aria-hidden="true">→</span></Link><Link className="flex min-h-11 items-center text-sm text-[var(--tm-text-muted)]" href="/privacy">개인정보 처리방침 <span className="ml-auto" aria-hidden="true">→</span></Link></div>
    <button className="mt-2 min-h-11 text-sm font-semibold text-[var(--tm-text-secondary)]" onClick={() => void signOut({ callbackUrl: "/login" })} type="button">로그아웃</button>
  </section>;
}
