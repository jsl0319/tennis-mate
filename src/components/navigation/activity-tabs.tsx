import { Tab, TabList, TabListItem } from "@wanteddev/wds";
import Link from "next/link";

type ActivityTab = "received" | "sent";

const tabs: Array<{ id: ActivityTab; href: string; label: string }> = [
  { id: "received", href: "/activity/received", label: "받은 신청" },
  { id: "sent", href: "/activity/sent", label: "보낸 신청" },
];

export function ActivityTabs({ current }: { current: ActivityTab }) {
  return (
    <Tab value={current}>
      <TabList aria-label="신청 활동 구분" className="mt-5">
        {tabs.map((tab) => (
          <TabListItem as={Link} href={tab.href} key={tab.id} value={tab.id}>
            {tab.label}
          </TabListItem>
        ))}
      </TabList>
    </Tab>
  );
}
