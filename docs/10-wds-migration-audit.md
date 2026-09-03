# WDS(Montage) 연동 현황 진단

## 1. 문서 정보

| 항목 | 내용 |
| --- | --- |
| 문서명 | WDS(Wanted Design System) Migration Audit |
| 문서 상태 | Draft v0.1 (조사만, 코드 변경 없음) |
| 기준 커밋 | `53399ad` (feat: set up Montage(WDS) design system integration foundation) |
| 작성 목적 | 화면 단위 WDS 컴포넌트 교체를 시작하기 전, 현재 UI 구현 방식과 WDS 컴포넌트 카탈로그를 매핑해 우선순위·리스크를 파악 |
| 다음 단계 | 공용 컴포넌트 3개 + CTA 버튼 80곳 + 인라인 모달 6곳 + 폼 3개 화면 입력 컴포넌트 교체 완료(9·10·11·12번 참고) → 로컬 화면에서 전역 레이아웃 붕괴 발견·근본 원인 수정(13번 참고) → 로컬 재확인 대기, 12번 말미의 남은 과제 중 결정 필요 |

foundation(Provider, 전역 CSS, 패키지 설치)만 구성된 상태이며, 화면·컴포넌트는 아직 하나도 WDS로 교체되지 않았다. 이 문서는 그 착수 전 조사 결과다.

## 2. 현재 UI 구현 방식

Rally On은 별도 UI 라이브러리(Radix, shadcn 등) 없이 **Tailwind CSS v4 유틸리티 클래스 + `<button>`/`<input>` 등 네이티브 HTML 엘리먼트**로 모든 화면을 직접 구현했다. 공용 컴포넌트는 `src/components/`에 단 5개뿐이고(`back-button`, `bottom-navigation`, `activity-tabs`, `court-rally-loader` + 테스트), 나머지는 `src/features/`의 각 화면 파일 안에 인라인으로 버튼·인풋·모달 스타일이 반복 작성되어 있다.

디자인 토큰은 `src/app/globals.css`에 `--tm-*` 접두사로 18개 정의되어 있다(`--tm-action-primary`, `--tm-bg-surface`, `--tm-text-secondary`, `--tm-tennis-ball` 등). 색상 대부분이 하드코딩이 아니라 이 토큰을 참조하고 있어, 토큰 레이어 자체는 비교적 일관되게 관리되고 있다.

## 3. 네이티브 UI 패턴 인벤토리

`src/features/`, `src/components/`, `src/app/` 전체 기준으로 grep한 결과다.

| 패턴 | 사용 파일 수 | 비고 |
| --- | --- | --- |
| `<button>` | 21 | 거의 모든 화면에 존재. 대부분 `min-h-*`, `rounded-*`, `bg-[var(--tm-action-primary)]` 조합을 파일마다 재작성 |
| `<input>` | 9 | 폼이 있는 화면(m4, m2, profile-edit, operator-* 등) |
| `<textarea>` | 6 | 리뷰/신고 메모, 매치 생성 등 |
| `<select>` | 3 | 사유 코드 선택 등 |
| `role="dialog"` (직접 구현 모달) | 6 | 별도 Modal 컴포넌트 없이 화면마다 직접 구현 |
| `type="checkbox"` | 3 | |
| `type="radio"` | 1 | |
| 탭 형태 UI (`Tabs`/`role="tab"` 유사 패턴) | 5 | `activity-tabs.tsx` 포함, 나머지는 화면 내부에 인라인 구현 |
| Modal/Toast/Badge/Chip/Spinner/Skeleton/Avatar/Tooltip 전용 컴포넌트 | 0 | 이런 이름의 별도 컴포넌트는 존재하지 않음 (필요한 곳마다 인라인 스타일로 대체) |

"primary CTA 버튼" 계열 클래스(`bg-[var(--tm-action-primary)]`)만 80곳에서 반복되고, 인풋/카드 테두리에 쓰이는 `border-[var(--tm-border-default)]`도 100곳에서 반복된다. 즉 시각적으로 이미 어느 정도 통일되어 있지만, 코드 레벨에서는 공용 컴포넌트로 추출되어 있지 않아 한 곳을 고치면 나머지도 손으로 맞춰야 하는 구조다.

## 4. WDS 컴포넌트 카탈로그 대비 매핑

`@wanteddev/wds@3.12.0`에는 다음 컴포넌트가 포함되어 있다(`node_modules/@wanteddev/wds/dist/components` 기준, 전체 목록). 현재 코드의 네이티브 패턴과 매핑하면:

| 현재 네이티브 구현 | WDS 대응 컴포넌트 | 교체 난이도 |
| --- | --- | --- |
| `<button>` (CTA, 액션) | `button`, `text-button`, `icon-button` | 낮음 — 가장 먼저 손댈 수 있는 영역 |
| `<input>` | `text-field`, `virtual-input` | 낮음~중간 |
| `<textarea>` | `text-area` | 낮음 |
| `<select>` | `select`, `select-multiple` | 중간 |
| `type="checkbox"` | `checkbox`, `round-checkbox` | 낮음 |
| `type="radio"` | `radio`, `radio-group` | 낮음 |
| 인라인 `role="dialog"` 모달 6곳 | `modal` | 중간 — 포커스 트랩/접근성을 WDS가 대신 처리해줘서 오히려 리스크 감소 |
| `activity-tabs.tsx` + 인라인 탭 4곳 | `tab`, `segmented-control` | 중간 |
| `bottom-navigation.tsx` | `bottom-navigation` | 중간 — 아이콘 커스텀(TennisBall 등) 유지 여부 확인 필요 |
| 없음 (상태 뱃지가 텍스트/색상 클래스로만 표현됨) | `chip`, `content-badge`, `push-badge` | 낮음 — 있으면 오히려 UI가 더 명확해질 영역 |
| 없음 (성공/실패 알림이 없거나 인라인 텍스트) | `snackbar`, `toast`, `section-message`, `alert` | 낮음~중간 |
| `court-rally-loader.tsx` | `loading`, `skeleton` | **비권장** — 테니스공이 튀는 브랜드 애니메이션이라 WDS 제네릭 로더로 바꾸면 브랜드 아이덴티티 손실. 그대로 유지 권장 |
| 없음 | `date-picker`, `time-picker` (예약/시간 관리 화면에서 잠재 활용) | 중간 |
| 없음 | `avatar`, `avatar-group` (매치/채팅 상대 표시) | 낮음 |

## 5. 중요 리스크: 브랜드 컬러 vs WDS 시맨틱 토큰

`@wanteddev/wds`는 자체 시맨틱 컬러 토큰(`--semantic-*`, `--atomic-*`, 약 900줄)을 전역 CSS로 가져온다. Rally On의 `--tm-*` 토큰과 **변수명은 겹치진 않아 충돌은 없지만**, `ThemeProvider`(`node_modules/@wanteddev/wds/dist/theme-provider`)는 `enableDarkMode`, `storageKey`, `disableDefaultGlobalStyle` 정도만 노출하고 **브랜드 컬러를 주입하는 공식 API가 없다**. 즉 WDS 컴포넌트를 기본값으로 쓰면 Wanted의 블루 계열 브랜드 색이 그대로 노출되고, Rally On의 그린/테니스볼 브랜드(`--tm-action-primary`, `--tm-tennis-ball`)와 시각적으로 어긋난다.

교체를 시작하기 전에 다음 중 하나를 결정해야 한다.

1. WDS 컴포넌트의 구조·접근성·상호작용 로직만 가져오고, `className`/`style` prop으로 색상을 Rally On 토큰으로 덮어쓴다 (컴포넌트별로 오버라이드 가능 여부 확인 필요).
2. `--semantic-*` CSS 변수를 전역에서 Rally On 브랜드 값으로 재정의한다 (WDS가 내부적으로 이 변수를 그대로 쓰는지 먼저 검증 필요 — 컴파일된 CSS-in-JS라면 안 먹힐 수 있음).
3. Wanted 블루 브랜드를 그대로 수용한다 (디자인 방향 자체를 바꾸는 결정이라 별도 논의 필요).

이 결정이 되어 있지 않으면 어떤 화면부터 교체하든 다시 손대야 할 가능성이 크다.

## 6. 제안 순서 (착수용, 확정 아님)

1. **4번 리스크(브랜드 컬러 전략) 먼저 결론** — 화면 교체보다 선행되어야 함.
2. 공용 컴포넌트 5개(`src/components/`) 중 `back-button`, `bottom-navigation`, `activity-tabs`를 WDS `icon-button`/`bottom-navigation`/`tab`으로 교체 — 영향 범위가 명확하고 파일 수가 적어 검증이 쉬움. `court-rally-loader`는 유지.
3. 반복도가 가장 높은 CTA 버튼(`bg-[var(--tm-action-primary)]`, 80곳)을 공용 `Button` 래퍼로 추출하면서 WDS `button`으로 교체 — 한 번에 가장 많은 화면에 영향.
4. 인라인 모달 6곳을 WDS `modal`로 교체 — 접근성(포커스 트랩) 개선 효과가 커서 우선순위 높음.
5. 폼이 몰려 있는 화면(`m4-match-create.tsx` 797줄, `m2-onboarding-flow.tsx` 321줄, `operator-time-management.tsx` 293줄)은 파일 크기가 커서 가장 나중, 별도 세션으로 분리 권장.

## 7. 조사에서 확인하지 못한 것

- WDS 컴포넌트가 `className` 오버라이드를 지원하는지, 지원한다면 어느 범위까지인지는 컴포넌트별 타입 정의(`.d.ts`)를 개별 확인해야 한다 (이번 조사는 목록 레벨까지만 확인함).
- montage-web 참고용 로컬 클론은 하지 않았다 — 실제 사용 예시(Storybook 등)가 필요하면 클론이 유용할 수 있음.

## 8. 결정: 브랜드 컬러 전략 (2026-09-03)

**Wanted Blue를 그대로 채택**하기로 결정했다. `src/app/globals.css`의 `--tm-*` 토큰 값을 Wanted의 `--atomic-blue-*` 램프 기준으로 재조정했다 (변수 이름과 컴포넌트 코드는 변경하지 않음 — 값만 교체).

| 토큰 | 이전 | 변경 | 근거 |
| --- | --- | --- | --- |
| `--tm-action-primary` | `#315e9e` | `#0066ff` | Wanted `semantic-primary-normal` |
| `--tm-action-hover` | `#244a80` | `#005eeb` | Wanted `semantic-primary-strong` |
| `--tm-bg-page` | `#fcfbf7` | `#f7fbff` | Wanted `atomic-blue-99` |
| `--tm-bg-subtle` | `#eef3f8` | `#eaf2fe` | Wanted `atomic-blue-95` |
| `--tm-bg-subtle-muted` | `#f4f7fa` | `#f0f6fe` | blue-95~99 보간 |
| `--tm-border-default` | `#d9e2ec` | `#c9defe` | Wanted `atomic-blue-90` |
| `--tm-border-strong` | `#9bb6d8` | `#9ec5ff` | Wanted `atomic-blue-80` |
| `--tm-border-subtle` | `#edf2f7` | `#edf3fc` | blue-95~99 보간 |
| `--tm-text-primary` | `#243044` | `#1e2a40` | 더 차분한 쿨톤으로 미세 조정 |

`--tm-bg-surface`, `--tm-text-secondary`, `--tm-text-muted`, `--tm-text-placeholder`, `--tm-tennis-ball`, `--tm-tennis-ball-muted`, `--tm-bg-highlight`, `--tm-status-error-bg`, `--tm-status-error-text`는 이미 충분히 쿨톤이거나(텍스트류), 의도적인 포인트 컬러(테니스볼)이거나, 가독성이 우선인 상태색(에러)이라 변경하지 않았다.

이로써 "5. 중요 리스크"에서 지적한 브랜드 컬러 결정이 완료되었다. 다음 단계는 "6. 제안 순서"의 2번(공용 컴포넌트 3개 교체)부터 진행한다.

## 9. 진행: 공용 컴포넌트 3개 교체 (2026-09-03)

"6. 제안 순서"의 2번을 완료했다. `src/components/navigation/`의 `back-button.tsx`, `bottom-navigation.tsx`, `activity-tabs.tsx`를 각각 WDS `IconButton`, `BottomNavigation`/`BottomNavigationItem`, `Tab`/`TabList`/`TabListItem`으로 교체했다 (커밋 `3e3fd2f`). `court-rally-loader.tsx`는 계획대로 유지.

- 세 컴포넌트 모두 공개 props(예: `BackButton`의 `ariaLabel`/`className`/`fallbackPath`)를 그대로 유지해서 호출부 코드는 수정하지 않았다.
- `bottom-navigation.tsx`, `activity-tabs.tsx`는 `BottomNavigationItem`/`TabListItem`을 `as={Link}`로 렌더링해 라우팅은 그대로 next/link가 담당하고, 활성 상태(`aria-current`, 밑줄/색상)는 WDS 컴포넌트가 `value` prop 비교로 자동 처리하도록 바꿨다 (기존엔 pathname을 직접 비교해서 className을 분기했음).
- `npm run typecheck`, `npm run lint` 통과 확인. `npm run dev`는 이 작업 환경(디바이스 브릿지 셸)의 네트워크 제약으로 SWC 바이너리를 받지 못해 기동 확인을 못 했다 — 로컬에서 눈으로 한 번 확인 필요.

다음 단계는 "6. 제안 순서"의 3번(반복도 높은 CTA 버튼 80곳을 공용 `Button`으로 추출)이다.

## 10. 진행: CTA 버튼 80곳을 공용 Button으로 교체 완료 (2026-09-03)

"6. 제안 순서"의 3번을 완료했다. `src/components/ui/button.tsx`에 WDS `Button`을 감싸는 공용 `Button` 컴포넌트를 새로 만들고, `bg-[var(--tm-action-primary)]` 조합을 파일마다 재작성하던 CTA 버튼·Link를 아래 21개 파일에서 이 컴포넌트로 교체했다(파일당 typecheck+lint 통과 후 개별 커밋).

`error.tsx`, `not-found.tsx`, `partner-session-list.tsx`, `partner-session-create.tsx`, `partner-session-detail.tsx`, `operator-application-status.tsx`, `m3-home.tsx`, `match-chat-list.tsx`, `m5-sent-applications.tsx`, `m8-my-page.tsx`, `profile-edit-page.tsx`, `operator-application-flow.tsx`, `operator-court-photo-management.tsx`, `match-chat-report-review.tsx`, `m3-match-detail.tsx`, `operator-application-review.tsx`, `operator-time-management.tsx`, `m2-onboarding-flow.tsx`, `m6-received-applications.tsx`, `match-conversation.tsx`, `m4-match-create.tsx`.

`partner-session-detail.tsx`와 `not-found.tsx`는 최초 조사 때 grep 대상에서 누락돼 있다가, 전체 교체를 마친 뒤 `bg-[var(--tm-action-primary)]`를 리포지토리 전체에서 재검색하는 과정에서 뒤늦게 발견해 함께 교체했다. 최종 재검색 결과 이제 이 클래스가 `<button>`/`<Link>`에 남아 있는 곳은 모두 의도적으로 네이티브를 유지하기로 한 곳뿐이다.

**Button 컴포넌트 설계**

- props: `variant`("primary" 기본값 = solid blue, "secondary" = outlined blue, "neutral" = outlined gray), `size`("small"/"medium"/"large", 기본 "large"), `fullWidth`, `loading`, `disabled`, 그리고 `as` prop으로 폴리모픽 렌더링(`as={Link}` + `href`로 네이티브 라우팅 유지, `as="a"`로 외부 링크 지원).
- `loading`이 켜지면 WDS 자체 스피너가 children을 대체하므로, 기존에 화면마다 손으로 `{saving ? "처리 중…" : children}` 식으로 텍스트를 바꿔치던 코드는 대부분 제거하고 `loading` prop에 맡겼다. 다만 `m4-match-create.tsx`의 `ActionFooter`처럼 단계별로 서로 다른 문구("등록 중…"/"사진 올리는 중…")를 보여줘야 하는 경우는 예외적으로 라벨 텍스트를 직접 계산해 넘겼다.
- 재시도(다시 불러오기) 버튼은 화면별 시각적 강조 정도에 따라 `variant`가 갈렸다(원래 배경이 solid blue였던 곳은 기본값 유지, outlined였던 곳은 `secondary`) — 통일된 규칙이라기보다 원래 화면 디자인을 최대한 보존하는 방향으로 판단했다.

**의도적으로 네이티브로 남긴 패턴** (WDS `Button`/`IconButton`의 solid·outlined 매트릭스로 표현이 안 되거나, 성격이 다른 UI라서)

- 선택형 토글/칩(`aria-pressed` 버튼, 지역·옵션 선택, 상태 필터 pill, 색상칩)
- 파괴적 액션(빨강 계열 버튼 — WDS Button에 danger 컬러가 없음): 예) "세션 취소·안내", "운영자 공개 일시 중지", "이 코트 비활성화"
- 배경·테두리 없는 순수 텍스트 버튼(예: "매칭 취소", "신고", "수정"/"로그아웃")
- 리스트 아이템 형태(코트/지역 검색 결과, 신청자 카드 등 클릭 가능한 카드 전체)
- `@phosphor-icons/react` 등 WDS 아이콘 세트가 아닌 별도 아이콘 라이브러리를 쓰는 아이콘 전용 버튼(`m4-match-create.tsx`의 뒤로가기·검색창 닫기·인원 증감 등) — 아이콘 색상 처리 방식이 다른 라이브러리와 섞이면 스타일이 깨질 위험이 있어 보수적으로 유지
- 단계형 폼 위저드의 상단 "‹"/"←" 뒤로가기 컨트롤(자체 진행률 UI와 결합된 화면 전용 요소)

**검증**

- 21개 파일 각각에 대해 `npm run typecheck`(`tsc --noEmit`)와 `npm run lint`(`eslint . --max-warnings=0`)를 통과한 뒤 개별 커밋했다.
- `npm run dev`는 이번에도 작업 환경(디바이스 브릿지 셸)의 네트워크 제약으로 SWC 바이너리를 받지 못해 기동 확인을 하지 못했다 — 로컬에서 화면을 눈으로 한 번 확인 권장.

다음 단계는 "6. 제안 순서"의 4번(인라인 모달 6곳을 WDS `modal`로 교체)이다.

## 11. 진행: 인라인 모달 6곳을 WDS Modal로 교체 완료 (2026-09-03)

"6. 제안 순서"의 4번을 완료했다. `role="dialog"`를 직접 구현하던 6개 바텀시트를 모두 WDS `Modal`/`ModalContainer`(`variant="bottom"`)로 교체했다. 대상 파일: `m6-received-applications.tsx`(LifecycleConfirm, DecisionConfirm), `m5-sent-applications.tsx`(WithdrawalConfirm), `match-conversation.tsx`(ReportSheet), `m3-match-detail.tsx`(ApplicationSheet), `operator-time-management.tsx`(SupplyIncidentSheet), `m4-match-create.tsx`(CourtPlaceDialog). 리포지토리 전체 기준으로 `role="dialog"`가 더 이상 남아 있지 않다.

**구조 매핑**

- `Modal`을 항상 `open` 상태로 렌더링하고(부모 컴포넌트가 조건부로 마운트/언마운트하는 기존 패턴은 그대로 유지), `onOpenChange`가 `false`로 바뀔 때(바깥 클릭·ESC 포함) 기존 `onClose`/`onCancel` 콜백을 호출하도록 연결했다.
- 제목/설명이 있는 화면은 `ModalContent` > `ModalContentItem` 안에 `ModalSummary`(작은 eyebrow 텍스트) + `ModalHeading`(제목) + `ModalDescription`(본문)을 넣었다. 닫기(X) 버튼이 필요한 화면은 `ModalNavigation trailingContent={<ModalClose aria-label="..." />}`를 사용했다 — `ModalClose`가 기본으로 WDS `IconClose` 아이콘과 닫기 동작을 제공하므로, 이전에 개별 화면마다 넣었던 `IconButton`+`IconClose` 조합을 제거할 수 있었다.
- 확인/취소 버튼 그룹은 `ActionArea`로 교체했다.
  - **`variant="strong"`** (세로로 쌓인 버튼): 확인용 팝업(LifecycleConfirm, DecisionConfirm, WithdrawalConfirm, SupplyIncidentSheet의 사유 선택 단계)에 사용. `ActionAreaButton variant="main"`은 실선 파랑 풀너비, `variant="alternative" buttonColor="assistive"`는 아웃라인 회색 풀너비 버튼이 된다.
  - **`variant="neutral"`** (가로 2등분 버튼): ReportSheet, ApplicationSheet, SupplyIncidentSheet의 세션 취소 확인 단계처럼 원래 화면이 두 버튼을 나란히 배치했던 곳에 사용 — `ActionAreaButton`은 `flex: 1 1 0`으로 자동 균등 분할된다.
  - 파괴적 액션("세션 취소·안내")은 WDS Button/ActionAreaButton에 danger 컬러가 없어 여전히 네이티브 `<button>`으로 남기되, `ActionArea variant="neutral"` 안에서 `className="flex-1"`로 옆의 `ActionAreaButton`과 너비를 맞췄다.
- `m4-match-create.tsx`의 CourtPlaceDialog는 원래 데스크톱에서 `sm:items-center`로 화면 중앙에 뜨는 반응형 레이아웃이 있었다. `ModalContainer`는 `xs`/`sm`/`md`/`lg`/`xl` prop으로 반응형 `variant`/`size`를 지원하지만, WDS 브레이크포인트 값이 Tailwind의 `sm:`(640px)과 실제로 일치하는지 이번 조사에서 확인하지 못했다. 잘못 맞추면 오히려 레이아웃이 깨질 위험이 있어, 이번에는 모바일 기준 `variant="bottom"` 하나로 단순화하고 데스크톱 중앙 배치는 포기했다 — 필요하면 WDS 브레이크포인트 토큰을 먼저 확인한 뒤 별도로 복원할 수 있다.

**WDS가 대신 처리하게 된 것** (기존에는 각 화면이 직접 구현했던 부분)

- 포커스 트랩(`FocusScope`), 바깥 클릭/ESC로 닫기, 스크롤 잠금, 배경 dimmer 페이드
- 바텀시트 진입 애니메이션(아래에서 위로 슬라이드) — 기존 구현엔 애니메이션이 전혀 없었다
- 상단 모서리 둥글리기, `env(safe-area-inset-bottom)` 패딩, 최대 높이 계산

**검증**

- 6개 파일 각각 `npm run typecheck`, `npm run lint` 통과 후 개별 커밋. 마지막에 리포지토리 전체에서 `role="dialog"` 재검색으로 누락이 없는지 확인했다.
- `npm run dev`는 이번에도 이 작업 환경(디바이스 브릿지 셸)의 네트워크 제약으로 기동 확인을 하지 못했다 — 특히 Modal은 애니메이션·포커스 트랩·반응형 동작이 코드만으로 완전히 검증되지 않으므로, 로컬에서 실제 화면을 열어 확인하는 게 이번 단계에서는 더 중요하다.

다음 단계는 "6. 제안 순서"의 5번(폼이 몰려 있는 화면인 `m4-match-create.tsx`, `m2-onboarding-flow.tsx`, `operator-time-management.tsx`의 `<input>`/`<textarea>`/`<select>` 등을 WDS 폼 컴포넌트로 교체)이다.

## 12. 진행: 폼이 몰린 화면 3곳의 입력 컴포넌트 교체 완료 (2026-09-03)

"6. 제안 순서"의 5번을 완료했다. `m4-match-create.tsx`, `m2-onboarding-flow.tsx`, `operator-time-management.tsx`의 `<input>`/`<textarea>`/`<select>`/체크박스를 WDS 입력 컴포넌트로 교체했다. (나머지 파일들에 흩어져 있는 소수의 입력 요소는 이번 범위에 포함하지 않았다 — 필요하면 별도로 진행.)

**구조 매핑**

- `FormField`(세로 flex 컨테이너, 컨텍스트 제공) > `FormLabel`(라벨, `required` prop으로 빨간 `*` 표시) > `FormControl`(Radix Slot으로 자식에 `id`/`aria-describedby`/`aria-labelledby` 자동 연결) > 실제 입력 컴포넌트, 순서로 감쌌다. `FormLabel`은 `FormField` 컨텍스트 밖에서는 쓸 수 없다(내부적으로 Radix Context를 사용해 벗어나면 에러) — 그래서 단일 필드에 1:1로 대응하지 않는 그룹 헤딩(예: m4의 "테니스장"/"매칭 시간"/"활동 지역")은 계속 화면 자체의 `FieldTitle` 컴포넌트를 사용했다.
- `<input type="text">` 계열은 `TextField`로, `<textarea>`는 `TextArea`로 교체 — 둘 다 실제 `<input>`/`<textarea>` DOM 엘리먼트를 렌더링하므로 `value`/`onChange`/`maxLength`/`disabled`/`type`/`min`/`inputMode` 같은 표준 속성을 그대로 넘길 수 있다.
- 돋보기 아이콘이 붙은 검색용 입력(온보딩 지역 검색, 매칭 생성의 테니스장 검색, 운영자 시·군·구 검색)은 `SearchField`로 교체했다 — 검색 아이콘이 내장돼 있어 기존에 손으로 넣던 `MagnifyingGlass` 아이콘과 절대 위치 스타일을 제거할 수 있었고, `onReset`으로 지우기 동작도 함께 얻었다.
- 시·도/시·군·구 `<select>` 2곳은 WDS `Select`+`Option`으로 교체했다. WDS `Select`는 네이티브 select가 아니라 팝오버 기반 커스텀 컴포넌트라 `<option>` 대신 `<Option value="...">` children으로 목록을 구성하고, `onChange`가 이벤트가 아니라 선택된 문자열 값을 직접 준다. 원래 네이티브 select에 있던 빈 문자열 placeholder `<option>`(다시 선택해서 초기화하는 용도)은 WDS Select 목록엔 없다 — `placeholder` prop은 값이 비어 있을 때 트리거에 보여주는 문구일 뿐 목록 항목이 아니어서, 한번 선택한 뒤 드롭다운에서 직접 "선택 안 함"으로 되돌리는 경로는 사라졌다(다른 시·도를 다시 고르는 것은 그대로 가능).
- 체크박스(온보딩의 "가까운 지역도 괜찮아요")는 WDS `Checkbox`로 교체했다 — `checked`/`onCheckedChange`(불리언 값을 직접 줌) 방식이라 기존 `onChange`+`event.target.checked` 패턴에서 바뀌었다.
- 전체 코트 비용 입력의 "원" 단위 표시는 기존에 입력 위에 절대 위치로 겹쳐 그리던 `<span>`을 `TextField`의 `trailingContent={<TextFieldContent variant="text">원</TextFieldContent>}`로 교체했다.
- `m4-match-create.tsx`에서 모든 입력에 공통으로 쓰이던 `controlClassName` 문자열 상수는 사용처가 전부 교체되어 삭제했다.

**네이티브로 남긴 것**

- 사진 업로드용 `<input type="file">`(sr-only + 커스텀 트리거 라벨) — WDS에 대응하는 파일 선택 컴포넌트가 없어 그대로 유지.
- 라디오 버튼(채팅 신고 사유), 이미 앞선 단계에서 "선택 카드/토글 chip" 패턴으로 판단해 네이티브로 남긴 아이템들(코트 검색 결과 리스트, 옵션 선택 카드 등)은 이번에도 손대지 않았다.

**검증**

- 3개 파일 각각 `npm run typecheck`, `npm run lint` 통과 후 개별 커밋. `npm run dev`는 이 작업 환경(디바이스 브릿지 셸)의 네트워크 제약으로 여전히 기동 확인을 하지 못했다 — 특히 `Select`(팝오버 목록)와 `SearchField`(reset 버튼)는 실제 클릭 상호작용을 코드만으로 완전히 검증할 수 없으므로 로컬에서 직접 확인이 필요하다.

다음 단계는 "6. 제안 순서"에 남은 항목이 없다 — 이 문서의 4번 섹션에서 언급했던 나머지 화면들(chip/badge, snackbar/toast, date-picker/time-picker, avatar 등 아직 활용하지 않은 WDS 컴포넌트)을 어디에 도입할지, 그리고 이번에 범위 밖으로 남긴 소수의 입력 요소(라디오, 나머지 파일들의 개별 input/textarea)를 이어서 정리할지 결정이 필요하다.

## 13. 긴급 수정: WDS global.css가 Tailwind 유틸리티 클래스를 전역에서 무력화하던 문제

9~12번 작업(공용 컴포넌트/CTA 버튼/모달/폼 컴포넌트 교체)을 모두 마친 뒤 로컬에서 실제 화면을 확인한 결과, 이번에 손댄 화면뿐 아니라 앱 전체에서 레이아웃이 깨지고 정렬이 맞지 않는 문제가 발견됐다. `npm run typecheck`/`npm run lint`는 매 커밋마다 통과했지만 이 둘은 CSS/레이아웃 결함을 잡아내지 못한다는 사실이 드러난 사례다.

**원인 (node_modules 내 컴파일된 소스를 직접 읽어 확인)**

- `node_modules/@wanteddev/wds/dist/global.css`는 레이어로 감싸지 않은(unlayered) 순수 CSS reset을 포함한다: `div, span, p, a, button, ul, li, form, label, table` 등 광범위한 엘리먼트에 `margin: 0; padding: 0; border: 0; font: inherit; vertical-align: baseline;`, 그리고 `body { line-height: 1; }`, `ol, ul { list-style: none; }` 등.
- `node_modules/tailwindcss/index.css`는 최상단에서 `@layer theme, base, components, utilities;`를 선언하고, Preflight(리셋)와 모든 유틸리티 클래스 생성 결과를 예외 없이 이 네 레이어 안에 넣는다.
- [CSS Cascade Layers 명세](https://www.w3.org/TR/css-cascade-5/#layering)상 레이어에 속하지 않은(unlayered) 규칙은 명시도(specificity)나 소스 순서와 무관하게 레이어에 속한 규칙보다 항상 우선한다. 기존에는 `layout.tsx`에서 `import "./globals.css"` 다음에 `import "@wanteddev/wds/global.css"`를 일반 JS import로 각각 불러오고 있었는데, 이렇게 불러온 WDS의 global.css는 어떤 레이어에도 속하지 않은 채였다.
- 결과적으로 WDS의 reset이 Tailwind의 `mt-4`, `p-4`, `border`, `rounded-2xl`, `font-bold` 같은 margin/padding/border/font 관련 유틸리티 클래스를 **명시도와 무관하게** 계속 이기고 있었다 — `<button className="rounded-2xl border px-4">`처럼 클래스 선택자를 쓴 Tailwind 유틸리티조차, 단순 타입 선택자인 WDS의 unlayered `button { border: 0 }`에 졌다는 뜻이다. 이번 마이그레이션 대상 파일만이 아니라 `<div>`/`<p>`/`<a>`/`<ul>`/`<form>`/`<table>`을 쓰는 모든 화면이 영향을 받았다.
- 부수 효과로 `body, textarea, input { font-family: 'Pretendard Variable' ... }`도 unlayered라, `src/app/globals.css`가 지정한 `--font-sans`(Noto Sans KR) 기반 `body` 폰트 지정을 이겨서 전역 폰트가 의도와 다르게 나오고 있었다.

**수정**

`src/app/globals.css` 최상단에 레이어 우선순위를 먼저 선언해 WDS의 global.css를 Tailwind보다 낮은 별도 레이어(`wds-reset`)에 격리했다 — Tailwind CSS v4 공식 문서가 서드파티 CSS를 다룰 때 권장하는 패턴과 동일하다.

```css
@layer wds-reset, theme, base, components, utilities;

@import "tailwindcss";
@import "@wanteddev/wds/global.css" layer(wds-reset);
```

CSS의 `layer()` 문법은 실제 CSS `@import`문에서만 동작하고 JS의 일반 `import "*.css"` 구문에는 적용할 수 없으므로, `layout.tsx`에 있던 `import "@wanteddev/wds/global.css";`는 제거하고 위 CSS `@import`로 통합했다.

**검증 한계 (중요)**

이 작업 환경(디바이스 브릿지 device_bash 셸)은 실제로는 Linux arm64 VM이라, Next.js의 SWC 바이너리와 `lightningcss` 네이티브 바이너리 모두 darwin-arm64 버전만 설치돼 있고 linux-arm64 버전은 없다. 레지스트리 접근도 막혀 있어(403 Forbidden) 새로 받을 수도 없다. 이를 직접 확인하기 위해:

1. `npm run build`(`next build --webpack`)를 시도 → SWC 바이너리 로드 실패로 빌드 자체가 되지 않음을 확인.
2. `@tailwindcss/postcss` + `postcss`를 Next.js 없이 직접 호출해 `globals.css` 하나만 컴파일 시도 → `lightningcss` 네이티브 바이너리(linux-arm64-gnu) 부재로 동일하게 실패.
3. 부재한 바이너리를 `npm install`로 개별 설치 시도 → 레지스트리 403으로 실패.

즉 이번 수정은 (a) 두 패키지의 실제 컴파일된 소스를 직접 읽어 충돌 지점을 특정하고 (b) Tailwind CSS v4 공식 문서가 명시하는 해결 패턴을 그대로 적용한 것이지만, **이 환경에서 실제 빌드·렌더링으로 재현·검증하는 것은 구조적으로 불가능했다.** `npm run typecheck`/`npm run lint`는 통과하지만, 애초에 "타입·린트만 통과하고 실제 화면은 깨져 있던" 것이 이 문제 자체이므로, 이번 커밋은 반드시 로컬 `npm run dev`로 화면을 직접 확인해 주어야 한다.
