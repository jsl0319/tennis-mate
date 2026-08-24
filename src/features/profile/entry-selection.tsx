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
    <main className="min-h-svh bg-[#fffdfc] px-5 py-11 text-[#1a221e]">
      <section className="mx-auto max-w-[350px]">
        <p className="text-sm font-semibold text-[#1f7a55]">● Tennis Mate</p>

        <header className="mt-[72px]">
          <h1 className="text-2xl font-bold leading-[34px]">어떻게 시작할까요?</h1>
          <p className="mt-2 text-sm leading-[21px] text-[#5c6b63]">함께 칠 메이트를 찾거나,<br />테니스장을 운영하는 방식으로 시작할 수 있어요.</p>
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

        <p className="mt-9 text-center text-sm leading-[21px] text-[#5c6b63]">두 경우 모두 카카오 계정으로 시작해요.</p>
        <p className="mt-6 text-center text-xs leading-[18px] text-[#5c6b63]">계속하면 <Link className="font-semibold text-[#1f7a55] underline" href="/terms">서비스 이용약관</Link>과<br /><Link className="font-semibold text-[#1f7a55] underline" href="/privacy">개인정보 처리방침</Link>에 동의하게 됩니다.</p>
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
      className={`flex h-[166px] w-full flex-col rounded-3xl p-5 text-left transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${isPrimary ? "bg-[#1f7a55] text-white shadow-[0_7px_18px_rgba(31,122,85,0.18)]" : "border border-[#d8e0db] bg-white text-[#1a221e] shadow-[0_4px_12px_rgba(23,67,45,0.06)]"}`}
      disabled={disabled}
      onClick={() => onClick(intent)}
      type="button"
    >
      <span className="text-lg font-medium leading-[26px]">{title}</span>
      <span className={`mt-3 text-sm leading-[21px] ${isPrimary ? "text-white/90" : "text-[#5c6b63]"}`}>{description}</span>
      <span className={`mt-auto text-sm font-bold leading-[21px] ${isPrimary ? "text-white" : "text-[#1f7a55]"}`}>{loading ? "카카오 연결 중…" : children}</span>
    </button>
  );
}
