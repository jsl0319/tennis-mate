import { encode } from "next-auth/jwt";
import { expect, test, type BrowserContext } from "@playwright/test";

import { E2E_AUTH_SECRET, E2E_BASE_URL } from "./e2e-environment";
import { disconnectE2eDatabase, e2eUsers, resetE2eDatabase, type E2eFixture } from "./fixtures";

async function signInAs(context: BrowserContext, userId: string) {
  const value = await encode({
    token: { sub: userId, userId },
    secret: E2E_AUTH_SECRET,
    salt: "authjs.session-token",
    maxAge: 60 * 60,
  });
  await context.addCookies([{ name: "authjs.session-token", value, url: E2E_BASE_URL, httpOnly: true, sameSite: "Lax" }]);
}

let fixture: E2eFixture;

test.beforeEach(async () => {
  fixture = await resetE2eDatabase();
});

test.afterAll(async () => {
  await disconnectE2eDatabase();
});

test("코트 매칭은 모바일에서도 상단 제목과 하단 메뉴를 유지한다", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await signInAs(context, e2eUsers.host.id);
  const page = await context.newPage();

  await page.goto("/partner-sessions");

  await expect(page.getByRole("heading", { name: "코트 매칭" })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "매칭", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "코트 매칭", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "채팅", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "마이", exact: true })).toBeVisible();

  await context.close();
});

test("참가 신청과 수락 뒤 채팅은 멤버에게만 열리고 제3자는 읽지 못한다", async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await signInAs(hostContext, e2eUsers.host.id);
  const hostPage = await hostContext.newPage();

  await hostPage.goto("/matches/new");
  await hostPage.getByRole("button", { name: "코트를 예약했어요" }).click();
  const startsOn = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10);
  await hostPage.getByLabel("날짜").fill(startsOn);
  await hostPage.getByLabel("시작 시간").fill("10:00");
  await hostPage.getByLabel("시선택").selectOption("E2E-SEOUL");
  await hostPage.getByLabel("구선택").selectOption("E2E-SEOUL-001");
  await hostPage.getByLabel("코트장 이름").fill("E2E 테니스장");
  await hostPage.getByLabel("주소").fill("서울시 E2E 마포구 1");
  await hostPage.getByRole("button", { name: "다음" }).click();
  await hostPage.getByLabel("매칭 제목").fill(fixture.matchTitle);
  await hostPage.getByRole("button", { name: "다음" }).click();
  await hostPage.getByLabel("전체 코트 비용").fill("24000");
  await hostPage.getByRole("button", { name: "다음" }).click();
  await hostPage.getByRole("button", { name: "매칭 공개하기" }).click();
  await expect(hostPage).toHaveURL(/\/matches\/[0-9a-f-]{36}$/);
  const matchId = new URL(hostPage.url()).pathname.split("/").at(-1);
  if (!matchId) throw new Error("생성된 Match ID를 확인하지 못했어요.");

  const applicantContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await signInAs(applicantContext, e2eUsers.applicant.id);
  const applicantPage = await applicantContext.newPage();

  await applicantPage.goto(`/matches/${matchId}`);
  await expect(applicantPage.getByRole("heading", { name: fixture.matchTitle })).toBeVisible();
  await applicantPage.getByRole("button", { name: "같이 치기" }).click();
  await applicantPage.getByLabel(/모집자에게 한마디/).fill("천천히 랠리하며 함께 연습하고 싶어요.");
  await applicantPage.getByRole("button", { name: "신청하기", exact: true }).click();
  await expect(applicantPage.getByRole("heading", { name: "신청을 보냈어요" })).toBeVisible();

  await hostPage.goto(`/activity/received/${matchId}`);
  await expect(hostPage.getByText("검토할 신청 1건").first()).toBeVisible();
  await hostPage.getByRole("link", { name: /신청 내용 보기/ }).click();
  await expect(hostPage.getByRole("heading", { name: `${e2eUsers.applicant.nickname}님을 검토해요` })).toBeVisible();
  await hostPage.getByRole("button", { name: "수락하기" }).click();
  await hostPage.getByRole("button", { name: "네, 함께 칠게요" }).click();
  await expect(hostPage.getByRole("heading", { name: "같이 치기로 했어요" })).toBeVisible();

  await applicantPage.goto("/activity/sent");
  await expect(applicantPage.getByText("같이 치게 됐어요. 매칭 정보를 확인해 주세요.")).toBeVisible();
  await applicantPage.getByRole("link", { name: "채팅방 열기" }).click();
  await expect(applicantPage.getByRole("heading", { name: fixture.matchTitle })).toBeVisible();
  await expect(applicantPage.getByRole("button", { name: "사진 추가" })).toBeVisible();
  await applicantPage.getByLabel("메시지").fill("E2E 자동화 메시지");
  const [messageResponse] = await Promise.all([
    applicantPage.waitForResponse((response) => response.url().includes(`/api/v1/matches/${matchId}/conversation/messages`) && response.request().method() === "POST"),
    applicantPage.getByRole("button", { name: "보내기" }).click(),
  ]);
  expect(messageResponse.ok()).toBeTruthy();
  await expect(applicantPage.getByText("E2E 자동화 메시지")).toBeVisible();
  await expect(applicantPage.getByLabel("아직 읽지 않은 상대 1명")).toBeVisible();

  await hostPage.goto(`/chats/${matchId}`);
  await expect(hostPage.getByText("E2E 자동화 메시지")).toBeVisible();
  await expect(applicantPage.getByLabel("아직 읽지 않은 상대 1명")).toHaveCount(0, { timeout: 12_000 });

  const outsiderContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await signInAs(outsiderContext, e2eUsers.outsider.id);
  const outsiderPage = await outsiderContext.newPage();
  await outsiderPage.goto(`/chats/${matchId}`);
  await expect(outsiderPage.getByText("E2E 자동화 메시지")).toHaveCount(0);
  await expect(outsiderPage.getByRole("link", { name: "채팅 목록" })).toBeVisible();

  await applicantContext.close();
  await hostContext.close();
  await outsiderContext.close();
});
