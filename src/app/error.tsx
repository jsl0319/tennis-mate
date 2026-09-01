"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-sm">
        <p className="text-sm font-semibold text-[var(--tm-action-primary)]">Rally On</p>
        <h1 className="mt-3 text-2xl font-bold text-[var(--tm-text-primary)]">
          잠시 문제가 생겼어요.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--tm-text-secondary)]">
          입력한 내용은 그대로 두고 다시 시도해 주세요. 계속 문제가 생기면
          잠시 후 이용해 주세요.
        </p>
        <button
          className="mt-6 min-h-12 w-full rounded-2xl bg-[var(--tm-action-primary)] px-5 font-semibold text-white hover:bg-[var(--tm-action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-action-primary)]"
          onClick={reset}
          type="button"
        >
          다시 시도하기
        </button>
      </section>
    </main>
  );
}
