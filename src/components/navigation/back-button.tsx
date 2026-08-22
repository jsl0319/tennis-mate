"use client";

import { useRouter } from "next/navigation";

import { returnToPreviousScreen } from "./back-navigation";

type BackButtonProps = {
  ariaLabel?: string;
  className?: string;
};

export function BackButton({ ariaLabel = "이전 화면으로 돌아가기", className = "" }: BackButtonProps) {
  const router = useRouter();

  return <button aria-label={ariaLabel} className={className} onClick={() => returnToPreviousScreen(window.history.length, () => router.back(), () => router.replace("/"))} type="button">←</button>;
}
