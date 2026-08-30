"use client";

import { ChatCircleDots, TennisBall, UserCircle, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const iconClassName = "size-7 shrink-0";

const navigationItems: NavigationItem[] = [
  { href: "/", label: "매칭", isActive: (pathname) => pathname === "/", icon: <UsersThree aria-hidden="true" className={iconClassName} weight="fill" /> },
  { href: "/partner-sessions", label: "코트 매칭", isActive: (pathname) => pathname.startsWith("/partner-sessions"), icon: <TennisBall aria-hidden="true" className={iconClassName} weight="fill" /> },
  { href: "/chats", label: "채팅", isActive: (pathname) => pathname.startsWith("/chats"), icon: <ChatCircleDots aria-hidden="true" className={iconClassName} weight="fill" /> },
  { href: "/my", label: "마이", isActive: (pathname) => pathname === "/my", icon: <UserCircle aria-hidden="true" className={iconClassName} weight="fill" /> },
];

export function BottomNavigation() {
  const pathname = usePathname();
  return <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tm-border-default)] bg-white/95 backdrop-blur"><div className="mx-auto grid max-w-[560px] grid-cols-4 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">{navigationItems.map((item) => {
    const active = item.isActive(pathname);
    return <Link aria-current={active ? "page" : undefined} className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold leading-none transition-colors ${active ? "text-[var(--tm-action-primary)]" : "text-[var(--tm-text-secondary)]"}`} href={item.href} key={item.href}>{item.icon}<span>{item.label}</span></Link>;
  })}</div></nav>;
}
