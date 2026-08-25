import Link from "next/link";

type ActivityTab = "received" | "sent";

const tabs: Array<{ id: ActivityTab; href: string; label: string }> = [
  { id: "received", href: "/activity/received", label: "받은 신청" },
  { id: "sent", href: "/activity/sent", label: "보낸 신청" },
];

export function ActivityTabs({ current }: { current: ActivityTab }) {
  return <nav aria-label="신청 활동 구분" className="mt-5 flex gap-6 border-b border-[var(--tm-border-default)] text-sm font-semibold">{tabs.map((tab) => {
    const active = tab.id === current;
    return <Link aria-current={active ? "page" : undefined} className={`pb-3 ${active ? "border-b-2 border-[var(--tm-action-primary)] text-[var(--tm-action-primary)]" : "text-[var(--tm-text-secondary)]"}`} href={tab.href} key={tab.id}>{tab.label}</Link>;
  })}</nav>;
}
