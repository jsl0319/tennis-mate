"use client";

import { BottomNavigation as WdsBottomNavigation, BottomNavigationItem } from "@wanteddev/wds";
import { ChatCircleDots, TennisBall, UserCircle, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  value: string;
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const iconClassName = "size-7 shrink-0";

const navigationItems: NavigationItem[] = [
  { value: "matches", href: "/", label: "매칭", isActive: (pathname) => pathname === "/", icon: <UsersThree aria-hidden="true" className={iconClassName} weight="fill" /> },
  { value: "partner-sessions", href: "/partner-sessions", label: "코트 매칭", isActive: (pathname) => pathname.startsWith("/partner-sessions"), icon: <TennisBall aria-hidden="true" className={iconClassName} weight="fill" /> },
  { value: "chats", href: "/chats", label: "채팅", isActive: (pathname) => pathname.startsWith("/chats"), icon: <ChatCircleDots aria-hidden="true" className={iconClassName} weight="fill" /> },
  { value: "my", href: "/my", label: "마이", isActive: (pathname) => pathname === "/my", icon: <UserCircle aria-hidden="true" className={iconClassName} weight="fill" /> },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const activeValue = navigationItems.find((item) => item.isActive(pathname))?.value;

  return (
    <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur">
      <WdsBottomNavigation className="mx-auto max-w-[560px] px-2 pb-[max(8px,env(safe-area-inset-bottom))]" value={activeValue}>
        {navigationItems.map((item) => (
          <BottomNavigationItem as={Link} href={item.href} icon={item.icon} key={item.value} label={item.label} value={item.value} />
        ))}
      </WdsBottomNavigation>
    </nav>
  );
}
