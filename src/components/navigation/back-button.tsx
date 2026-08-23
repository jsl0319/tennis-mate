"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  ariaLabel?: string;
  className?: string;
  fallbackPath?: string;
};

export function BackButton({ ariaLabel = "이전 화면으로 돌아가기", className = "", fallbackPath = "/" }: BackButtonProps) {
  const router = useRouter();

  return <button aria-label={ariaLabel} className={className} onClick={() => router.replace(fallbackPath)} type="button">←</button>;
}
