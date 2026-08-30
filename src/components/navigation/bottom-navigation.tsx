"use client";

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
  { href: "/", label: "매칭", isActive: (pathname) => pathname === "/", icon: <svg aria-hidden="true" className={iconClassName} fill="currentColor" viewBox="0 0 24 24"><path d="M8.25 10.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM3 19.75A5.25 5.25 0 0 1 8.25 14.5h.5A5.25 5.25 0 0 1 14 19.75v.75H3v-.75ZM16.25 10.25A2.75 2.75 0 1 0 16.25 4.75a2.75 2.75 0 0 0 0 5.5ZM14.2 14.75a5.82 5.82 0 0 1 1.05 3.35v1.4H21v-.5a4.25 4.25 0 0 0-4.25-4.25h-.5c-.71 0-1.39.18-2.05.5Z" /></svg> },
  { href: "/partner-sessions", label: "코트 매칭", isActive: (pathname) => pathname.startsWith("/partner-sessions"), icon: <svg aria-hidden="true" className={iconClassName} viewBox="0 0 24 24"><rect fill="currentColor" height="18" rx="2.5" width="18" x="3" y="3" /><path d="M12 3v18M3 12h18M7.5 6.5c1.2.8 2.1 2.1 2.1 3.7s-.9 2.9-2.1 3.7M16.5 6.5c-1.2.8-2.1 2.1-2.1 3.7s.9 2.9 2.1 3.7" fill="none" stroke="white" strokeLinecap="round" strokeWidth="1.65" /></svg> },
  { href: "/chats", label: "채팅", isActive: (pathname) => pathname.startsWith("/chats"), icon: <svg aria-hidden="true" className={iconClassName} fill="currentColor" viewBox="0 0 24 24"><path d="M5 4h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-7.1L7 21v-4H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" /></svg> },
  { href: "/my", label: "마이", isActive: (pathname) => pathname === "/my", icon: <svg aria-hidden="true" className={iconClassName} fill="currentColor" viewBox="0 0 24 24"><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0H4Z" /></svg> },
];

export function BottomNavigation() {
  const pathname = usePathname();
  return <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tm-border-default)] bg-white/95 backdrop-blur"><div className="mx-auto grid max-w-[560px] grid-cols-4 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">{navigationItems.map((item) => {
    const active = item.isActive(pathname);
    return <Link aria-current={active ? "page" : undefined} className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold leading-none transition-colors ${active ? "text-[var(--tm-action-primary)]" : "text-[var(--tm-text-secondary)]"}`} href={item.href} key={item.href}>{item.icon}<span>{item.label}</span></Link>;
  })}</div></nav>;
}
