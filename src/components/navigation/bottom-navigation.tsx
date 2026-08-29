"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const iconClassName = "size-6 shrink-0";

const navigationItems: NavigationItem[] = [
  { href: "/", label: "매칭", isActive: (pathname) => pathname === "/", icon: <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24"><ellipse cx="7.3" cy="7.3" rx="3.4" ry="4.4" stroke="currentColor" strokeWidth="2" transform="rotate(-40 7.3 7.3)" /><path d="m10 10.4 7.5 7.5M7.3 4.2v6.2M4.2 7.3h6.2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /><ellipse cx="16.7" cy="7.3" rx="3.4" ry="4.4" stroke="currentColor" strokeWidth="2" transform="rotate(40 16.7 7.3)" /><path d="m14 10.4-7.5 7.5M16.7 4.2v6.2M13.6 7.3h6.2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg> },
  { href: "/partner-sessions", label: "코트 매칭", isActive: (pathname) => pathname.startsWith("/partner-sessions"), icon: <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24"><path d="M4 5.5h16v13H4zM4 12h16M12 5.5v13M7.5 8.5c1.1.7 2 1.9 2 3.5s-.9 2.8-2 3.5M16.5 8.5c-1.1.7-2 1.9-2 3.5s.9 2.8 2 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg> },
  { href: "/chats", label: "채팅", isActive: (pathname) => pathname.startsWith("/chats"), icon: <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24"><path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8A1.5 1.5 0 0 1 19 16.5h-7.7L7 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg> },
  { href: "/my", label: "마이", isActive: (pathname) => pathname === "/my", icon: <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" /><path d="M5 21a7 7 0 0 1 14 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg> },
];

export function BottomNavigation() {
  const pathname = usePathname();
  return <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tm-border-default)] bg-white/95 backdrop-blur"><div className="mx-auto grid max-w-[560px] grid-cols-4 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">{navigationItems.map((item) => {
    const active = item.isActive(pathname);
    return <Link aria-current={active ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold leading-none transition-colors ${active ? "text-[var(--tm-action-primary)]" : "text-[var(--tm-text-secondary)]"}`} href={item.href} key={item.href}>{item.icon}<span>{item.label}</span></Link>;
  })}</div></nav>;
}
