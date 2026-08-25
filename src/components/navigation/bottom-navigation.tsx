"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const iconClassName = "size-5";

const navigationItems: NavigationItem[] = [
  { href: "/", label: "홈", isActive: (pathname) => pathname === "/", icon: <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg> },
  { href: "/matches/new", label: "만들기", isActive: (pathname) => pathname === "/matches/new", icon: <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg> },
  { href: "/activity/received", label: "활동", isActive: (pathname) => pathname.startsWith("/activity"), icon: <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24"><path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg> },
  { href: "/my", label: "마이", isActive: (pathname) => pathname === "/my", icon: <svg aria-hidden="true" className={iconClassName} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" /><path d="M5 21a7 7 0 0 1 14 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg> },
];

export function BottomNavigation() {
  const pathname = usePathname();
  return <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--tm-border-default)] bg-white/95 backdrop-blur"><div className="mx-auto grid max-w-[560px] grid-cols-4 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">{navigationItems.map((item) => {
    const active = item.isActive(pathname);
    return <Link aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition-colors ${active ? "text-[var(--tm-action-primary)]" : "text-[var(--tm-text-secondary)]"}`} href={item.href} key={item.href}>{item.icon}<span>{item.label}</span></Link>;
  })}</div></nav>;
}
