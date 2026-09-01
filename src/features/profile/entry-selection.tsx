"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

import { getSafeReturnTo, getStartAuthCallbackPath, type StartIntent } from "@/navigation/return-to";

type EntrySelectionProps = {
  returnTo?: string;
};

export function EntrySelection({ returnTo = "/" }: EntrySelectionProps) {
  const safeReturnTo = getSafeReturnTo(returnTo);
  const [loadingIntent, setLoadingIntent] = useState<StartIntent | null>(null);

  const start = (intent: StartIntent) => {
    setLoadingIntent(intent);
    void signIn("kakao", { callbackUrl: getStartAuthCallbackPath(intent, safeReturnTo) });
  };

  return (
    <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 py-11 text-[var(--tm-text-primary)]">
      <section className="mx-auto max-w-[350px]">
        <p className="text-sm font-semibold text-[var(--tm-action-primary)]">● Rally On</p>

        <header className="mt-[72px]">
          <h1 className="text-2xl font-bold leading-[34px]">어떻게 시작할까요?</h1>
          <p className="mt-2 text-sm leading-[21px] text-[var(--tm-text-secondary)]">함께 칠 메이트를 찾거나,<br />테니스장을 운영하는 방식으로 시작할 수 있어요.</p>
        </header>

        <div className="mt-16 grid gap-4">
          <EntryCard
            description={<>비슷한 실력의 사람과 부담 없이<br />테니스를 시작해요.</>}
            disabled={loadingIntent !== null}
            intent="PLAYER"
            loading={loadingIntent === "PLAYER"}
            onClick={start}
            title="테니스 메이트를 찾고 있어요"
          >
            메이트로 시작하기 →
          </EntryCard>
          <EntryCard
            description={<>운영하는 코트와 시간대를 준비하고,<br />심사 후 이용자에게 공개해요.</>}
            disabled={loadingIntent !== null}
            intent="OPERATOR"
            loading={loadingIntent === "OPERATOR"}
            onClick={start}
            title="테니스장을 운영하고 있어요"
            variant="secondary"
          >
            운영자로 등록하기 →
          </EntryCard>
        </div>

        <p className="mt-9 text-center text-sm leading-[21px] text-[var(--tm-text-secondary)]">두 경우 모두 카카오 계정으로 시작해요.</p>
        <p className="mt-6 text-center text-xs leading-[18px] text-[var(--tm-text-secondary)]">계속하면 <Link className="font-semibold text-[var(--tm-action-primary)] underline" href="/terms">서비스 이용약관</Link>과<br /><Link className="font-semibold text-[var(--tm-action-primary)] underline" href="/privacy">개인정보 처리방침</Link>에 동의하게 됩니다.</p>
      </section>
    </main>
  );
}

function EntryCard({ children, description, disabled, intent, loading, onClick, title, variant = "primary" }: {
  children: React.ReactNode;
  description: React.ReactNode;
  disabled: boolean;
  intent: StartIntent;
  loading: boolean;
  onClick: (intent: StartIntent) => void;
  title: string;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <button
      className={`flex h-[166px] w-full flex-col rounded-3xl p-5 text-left transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${isPrimary ? "bg-[var(--tm-action-primary)] text-white shadow-[0_7px_18px_rgba(49,94,158,0.18)]" : "border border-[var(--tm-border-default)] bg-white text-[var(--tm-text-primary)] shadow-[0_4px_12px_rgba(49,94,158,0.06)]"}`}
      disabled={disabled}
      onClick={() => onClick(intent)}
      type="button"
    >
      <span className="text-lg font-medium leading-[26px]">{title}</span>
      <span className={`mt-3 text-sm leading-[21px] ${isPrimary ? "text-white/90" : "text-[var(--tm-text-secondary)]"}`}>{description}</span>
      <span className={`mt-auto text-sm font-bold leading-[21px] ${isPrimary ? "text-white" : "text-[var(--tm-action-primary)]"}`}>{loading ? "카카오 연결 중…" : children}</span>
    </button>
  );
}
