# Tennis Mate API 명세

## 1. 문서 정보

| 항목 | 내용 |
| --- | --- |
| 문서명 | Tennis Mate API Specification |
| 문서 상태 | Draft v0.1 |
| 구현 범위 | Core MVP |
| 기준 문서 | `02-prd.md`, `03-screen-spec.md`, `04-erd.md` |
| 후속 문서 | `06-development-plan.md` |

이 문서는 Tennis Mate Core MVP의 클라이언트와 서버 사이 HTTP 계약을 정의한다. Court Partner Pilot과 Court Commerce API는 확장 방향만 별도 섹션에서 정의하며, 별도 구현 승인이 없으면 활성 범위로 간주하지 않는다.

## 2. 설계 목표

1. 화면이 필요한 정보를 추가 계산이나 여러 번의 우회 요청 없이 받을 수 있게 한다.
2. 매칭 신청과 수락의 핵심 규칙을 서버에서 일관되게 검증한다.
3. 데이터베이스 필드와 사용자에게 보여줄 파생 값을 구분한다.
4. 상태 충돌을 일반 오류와 구분하여 사용자가 최신 상태를 확인할 수 있게 한다.
5. Core MVP에 필요하지 않은 범용 API와 후속 단계 API를 미리 구현하지 않는다.

## 3. API 범위

### 3.1 Core MVP 활성 범위

- 현재 사용자와 온보딩 상태 조회
- 닉네임 확인·수정
- 테니스 프로필 생성·조회·수정
- 지역 목록 조회
- 추천 매칭과 일반 매칭 목록 조회
- 매칭 상세 조회
- 외부 예약 코트 기반 매칭 등록
- 같이 치기 신청
- 받은 신청 조회와 수락·거절
- 보낸 신청 조회와 대기 신청 철회
- 내가 만든 매칭 조회
- 한 명 이상 수락된 매칭의 조기 마감
- 매칭 취소
- 일정 종료 후 모집자의 매칭 완료 확인
- 수락된 신청자에게 매칭별 카카오 오픈채팅 링크 공개

### 3.2 Core MVP에서 확정하지 않는 API

- Auth.js가 관리하는 카카오 로그인·콜백 엔드포인트
- 공개 후 매칭 일정·코트 정보 수정
- 수락 후 신청자의 참가 취소
- 후기, 신고와 차단
- 코트 운영자, 제휴 코트 예약, 결제·환불·정산

카카오 인증의 실제 경로는 프로젝트 초기화 시 Auth.js 구성과 공식 호환성을 확인하여 README에 기록한다. 이 문서의 `/api/v1` 경로는 인증 프레임워크가 관리하는 로그인·콜백 경로와 분리된 제품 API다.

## 4. 공통 HTTP 계약

### 4.1 Base Path

```text
/api/v1
```

모든 요청과 응답은 별도 표시가 없으면 `application/json`을 사용한다.

### 4.2 인증

- 인증이 필요한 API는 서버가 검증한 세션의 User를 사용한다.
- 클라이언트가 보낸 `userId`, `hostUserId`, `applicantUserId`를 권한 판단에 사용하지 않는다.
- 첫 인증 공급자는 카카오다. 쿠키 이름과 세션 저장 방식은 Auth.js 구성을 확정할 때 정한다.
- 비로그인 요청은 `401 UNAUTHENTICATED`를 반환한다.
- 정지 또는 탈퇴 계정은 인증 성공 여부와 별개로 제품 API 접근을 차단한다.

### 4.3 필드 표기

- JSON 필드명은 `camelCase`를 사용한다.
- ID는 UUID 문자열이다.
- 시각은 UTC 오프셋이 포함된 ISO 8601 문자열로 전달한다.
- 날짜·시간을 비즈니스 판단에 사용할 때는 `startsAt`, `endsAt`을 사용한다.
- 금액은 원 단위 정수이며 필드명에 `Krw`를 붙인다.
- 선택하지 않은 값은 생략하거나 `null`로 전달할 수 있으나, 서버 응답은 각 DTO에서 정한 형태를 유지한다.

예:

```json
{
  "startsAt": "2026-08-22T01:00:00.000Z",
  "endsAt": "2026-08-22T03:00:00.000Z",
  "totalCourtFeeKrw": 40000
}
```

서울 화면에서는 위 시각을 `2026년 8월 22일 오전 10시~12시`로 표시한다.

### 4.4 성공 응답

단건 응답은 리소스를 직접 반환한다.

```json
{
  "id": "0198...",
  "status": "OPEN"
}
```

생성 성공은 `201 Created`, 조회·수정·상태 전환 성공은 `200 OK`, 응답 본문이 없는 로그아웃 같은 작업은 `204 No Content`를 사용한다.

### 4.5 목록 응답과 페이지네이션

목록은 cursor 기반 페이지네이션을 사용한다.

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": null,
    "hasNext": false
  }
}
```

- 기본 `limit`은 20, 최대 50이다.
- cursor는 클라이언트가 해석하지 않는 문자열이다.
- 동일 cursor를 다시 요청하면 가능한 한 같은 정렬 기준을 적용한다.
- 시간순 목록은 `startsAt`과 `id`를 함께 정렬 키로 사용한다.

### 4.6 오류 응답

```json
{
  "error": {
    "code": "MATCH_ALREADY_CLOSED",
    "message": "아쉽지만 방금 모집이 마감됐어요.",
    "fieldErrors": [],
    "requestId": "req_01..."
  }
}
```

`message`는 사용자에게 바로 보여줄 수 있는 한국어 기본 문구다. 클라이언트는 분기 처리를 `message`가 아니라 안정적인 `code`로 수행한다.

| HTTP | 용도 | 예시 코드 |
| ---: | --- | --- |
| 400 | JSON 형식·쿼리 형식 오류 | `INVALID_REQUEST` |
| 401 | 로그인 필요 | `UNAUTHENTICATED` |
| 403 | 권한 또는 온보딩 부족 | `FORBIDDEN`, `ONBOARDING_REQUIRED` |
| 404 | 없거나 노출할 수 없는 리소스 | `MATCH_NOT_FOUND` |
| 409 | 현재 상태와 충돌 | `MATCH_ALREADY_CLOSED`, `NO_REMAINING_SPOTS` |
| 422 | 필드 검증 실패 | `VALIDATION_FAILED` |
| 429 | 요청 제한 초과 | `RATE_LIMITED` |
| 500 | 예상하지 못한 서버 오류 | `INTERNAL_ERROR` |

필드 오류 예:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "입력한 내용을 다시 확인해 주세요.",
    "fieldErrors": [
      {
        "field": "endsAt",
        "code": "MUST_BE_AFTER_START",
        "message": "종료 시간은 시작 시간보다 늦어야 해요."
      }
    ],
    "requestId": "req_01..."
  }
}
```

### 4.7 상태 충돌 응답

상태가 바뀌어 요청을 처리할 수 없는 경우 `409 Conflict`와 함께 화면 갱신에 필요한 최소 최신 상태를 제공할 수 있다.

```json
{
  "error": {
    "code": "NO_REMAINING_SPOTS",
    "message": "방금 마지막 자리가 채워졌어요.",
    "requestId": "req_01...",
    "currentState": {
      "matchStatus": "CLOSED",
      "remainingSpots": 0,
      "version": 4
    }
  }
}
```

### 4.8 낙관적 잠금

상태를 바꾸는 요청은 대상 리소스의 `expectedVersion`을 받을 수 있다. 서버는 최신 상태를 트랜잭션 안에서 다시 검증하며, 버전이 다르면 `409 VERSION_CONFLICT`를 반환한다.

버전은 권한이나 상태 검증을 대체하지 않는다.

### 4.9 재시도와 중복 요청

- 신청 생성은 `(matchId, applicantUserId)` 유일 제약으로 중복을 방지한다.
- 수락·거절·철회·취소 요청은 같은 최종 상태에 대한 재요청이면 현재 리소스를 반환할 수 있다.
- 서로 다른 최종 상태로 이미 전환된 경우 `409 APPLICATION_STATE_CONFLICT`를 반환한다.
- 매칭 생성은 요청의 `clientRequestId`와 세션 User를 묶어 멱등성을 보장한다. 같은 키의 재요청은 새 Match를 만들지 않고 기존 Match를 반환한다.

## 5. 공통 Enum

### 5.1 테니스 프로필

```text
ExperienceRange = UNDER_3_MONTHS | MONTHS_3_TO_6 | MONTHS_6_TO_12 | YEARS_1_TO_2 | YEARS_2_PLUS
RallyLevel = STARTING | SHORT_RALLY | COMFORTABLE_RALLY | STANDARD_RALLY
GameExperience = NONE | KNOWS_RULES | PLAYED_FEW | CAN_PLAY
PlayPurpose = CASUAL_HIT | RALLY_PRACTICE | STROKE_PRACTICE | GAME_INTRO | GAME
```

### 5.2 매칭

```text
CourtSource = EXTERNAL_RESERVED
PartnerPreference = COMPLETE_BEGINNER_WELCOME | SIMILAR_LEVEL | GAME_CAPABLE
MatchStatus = OPEN | CLOSED | COMPLETED | EXPIRED | CANCELLED
ApplicationStatus = PENDING | ACCEPTED | REJECTED | WITHDRAWN | CANCELLED
```

Core MVP 생성 API는 `CourtSource`로 `EXTERNAL_RESERVED`만 허용한다. 후속 enum 값이 DB에 존재하더라도 클라이언트가 임의로 사용할 수 없다.

## 6. 공통 응답 모델

### 6.1 RegionSummary

```json
{
  "code": "SEOUL-MAPO",
  "name": "마포구",
  "parent": {
    "code": "SEOUL",
    "name": "서울"
  }
}
```

### 6.2 TennisProfileView

```json
{
  "experienceRange": "MONTHS_6_TO_12",
  "experienceLabel": "6개월~1년",
  "rallyLevel": "COMFORTABLE_RALLY",
  "rallyLevelLabel": "편하게 랠리할 수 있어요",
  "gameExperience": "NONE",
  "gameExperienceLabel": "아직 안 해봤어요",
  "playPurposes": [
    {
      "code": "RALLY_PRACTICE",
      "label": "랠리 연습"
    }
  ],
  "activityRegion": {
    "code": "SEOUL-MAPO",
    "name": "마포구",
    "parentCode": "SEOUL"
  },
  "nearbyRegionAllowed": true,
  "version": 3,
  "updatedAt": "2026-08-12T08:20:00.000Z"
}
```

내부 정렬값과 추천 점수는 응답하지 않는다.

### 6.3 MatchCardView

```json
{
  "id": "0198...",
  "title": "천천히 랠리 연습해요",
  "status": "OPEN",
  "statusLabel": "모집 중",
  "startsAt": "2026-08-22T01:00:00.000Z",
  "endsAt": "2026-08-22T03:00:00.000Z",
  "region": {
    "code": "SEOUL-MAPO",
    "name": "마포구"
  },
  "court": {
    "source": "EXTERNAL_RESERVED",
    "sourceLabel": "모집자가 코트를 예약했어요",
    "name": "마포 테니스장"
  },
  "playPurposes": [
    {
      "code": "RALLY_PRACTICE",
      "label": "랠리 연습"
    }
  ],
  "partnerPreference": "COMPLETE_BEGINNER_WELCOME",
  "beginnerWelcome": true,
  "recruitCount": 2,
  "acceptedCount": 1,
  "remainingSpots": 1,
  "estimatedTotalParticipants": 3,
  "estimatedFeePerPersonKrw": 13334,
  "recommendationReasons": [
    {
      "code": "SAME_PLAY_PURPOSE",
      "label": "둘 다 랠리 연습을 원해요."
    }
  ]
}
```

예상 1인 비용은 `ceil(totalCourtFeeKrw / (recruitCount + 1))`로 계산하고 사용자가 수정할 수 없다. 1원 단위 나머지를 어떻게 실제 정산할지는 서비스 밖에서 참가자들이 확인한다.

### 6.4 MatchDetailView

`MatchCardView`의 모든 필드에 다음 정보를 추가한다.

```json
{
  "court": {
    "source": "EXTERNAL_RESERVED",
    "sourceLabel": "모집자가 코트를 예약했어요",
    "name": "마포 테니스장",
    "address": "서울 마포구 ...",
    "courtNumber": "2번 코트"
  },
  "totalCourtFeeKrw": 40000,
  "additionalCostNote": "조명비 포함",
  "introduction": "빠르지 않게 편하게 쳐요.",
  "partnerPreferenceLabel": "완전 초보도 좋아요",
  "host": {
    "nickname": "지선",
    "tennisProfile": {
      "experienceRange": "MONTHS_6_TO_12",
      "experienceLabel": "6개월~1년",
      "rallyLevel": "COMFORTABLE_RALLY",
      "rallyLevelLabel": "편하게 랠리할 수 있어요",
      "gameExperience": "NONE",
      "gameExperienceLabel": "아직 안 해봤어요",
      "playPurposes": [
        {
          "code": "RALLY_PRACTICE",
          "label": "랠리 연습"
        }
      ],
      "activityRegion": {
        "code": "SEOUL-MAPO",
        "name": "마포구",
        "parentCode": "SEOUL"
      },
      "nearbyRegionAllowed": true
    }
  },
  "viewer": {
    "relation": "NONE",
    "canApply": true,
    "applyBlockedReason": null,
    "applicationId": null,
    "canComplete": false
  },
  "contact": null,
  "version": 3,
  "createdAt": "2026-08-12T08:20:00.000Z"
}
```

`viewer.relation` 값:

```text
NONE | HOST | APPLICANT
```

`applyBlockedReason` 후보:

```text
ONBOARDING_REQUIRED | OWN_MATCH | ALREADY_APPLIED | MATCH_NOT_OPEN | MATCH_STARTED | NO_REMAINING_SPOTS
```

비로그인 사용자는 이 API를 호출할 수 없다. `contact`는 모집자 또는 연결 Application이 `ACCEPTED`인 신청자에게만 다음 형태로 반환한다.

```json
{
  "type": "KAKAO_OPEN_CHAT",
  "url": "https://open.kakao.com/o/example",
  "label": "카카오 오픈채팅으로 연락하기"
}
```

그 외 사용자에게는 `null`이며 존재 여부도 별도 필드로 노출하지 않는다. `viewer.canComplete`는 모집자이면서 `status = CLOSED`이고 `endsAt <= now`일 때만 true다.

### 6.5 MatchApplicationView

```json
{
  "id": "0198...",
  "status": "PENDING",
  "statusLabel": "검토 중",
  "message": "천천히 랠리하고 싶어요.",
  "applicant": {
    "nickname": "테니스새싹",
    "profileSnapshot": {
      "schemaVersion": 1,
      "profileVersion": 3,
      "experienceRange": "MONTHS_6_TO_12",
      "experienceLabel": "6개월~1년",
      "rallyLevel": "SHORT_RALLY",
      "rallyLevelLabel": "몇 번씩 주고받을 수 있어요",
      "gameExperience": "NONE",
      "gameExperienceLabel": "아직 안 해봤어요",
      "playPurposes": [
        {
          "code": "RALLY_PRACTICE",
          "label": "랠리 연습"
        }
      ],
      "activityRegion": {
        "code": "SEOUL-MAPO",
        "name": "마포구",
        "parentCode": "SEOUL"
      },
      "nearbyRegionAllowed": true
    }
  },
  "match": {
    "id": "0198...",
    "title": "천천히 랠리 연습해요",
    "status": "OPEN",
    "startsAt": "2026-08-22T01:00:00.000Z",
    "endsAt": "2026-08-22T03:00:00.000Z",
    "courtName": "마포 테니스장",
    "regionName": "마포구",
    "estimatedFeePerPersonKrw": 13334
  },
  "createdAt": "2026-08-12T08:30:00.000Z",
  "decidedAt": null,
  "withdrawnAt": null,
  "cancelledAt": null
}
```

신청자 프로필은 현재 프로필이 아니라 신청 당시 스냅샷을 사용한다. 닉네임은 현재 User에서 읽으며 연락처는 포함하지 않는다.

본인 신청 응답에서는 `status = ACCEPTED`일 때만 `match.contact`에 카카오 오픈채팅 정보를 포함한다. PENDING·REJECTED·WITHDRAWN·CANCELLED에서는 `null`이다.

## 7. 현재 사용자 API

### 7.1 현재 사용자 조회

```http
GET /api/v1/me
```

인증: 필수

응답 `200 OK`:

```json
{
  "id": "0198...",
  "nickname": "지선",
  "nicknameConfirmed": true,
  "status": "ACTIVE",
  "onboardingCompleted": true,
  "tennisProfile": {
    "experienceRange": "MONTHS_6_TO_12",
    "experienceLabel": "6개월~1년",
    "rallyLevel": "COMFORTABLE_RALLY",
    "rallyLevelLabel": "편하게 랠리할 수 있어요",
    "gameExperience": "NONE",
    "gameExperienceLabel": "아직 안 해봤어요",
    "playPurposes": [],
    "activityRegion": null,
    "nearbyRegionAllowed": true,
    "version": 3,
    "updatedAt": "2026-08-12T08:20:00.000Z"
  }
}
```

온보딩 전에는 `tennisProfile`이 `null`이다.

`onboardingCompleted`는 닉네임 확인과 TennisProfile 저장이 모두 끝났을 때 true다.

### 7.2 닉네임 확인·수정

```http
PATCH /api/v1/me
```

인증: 필수

요청:

```json
{
  "nickname": "테니스새싹"
}
```

규칙:

- 앞뒤 공백 제거 후 2~12자, 한글·영문·숫자만 허용
- 정규화된 닉네임은 유일해야 한다.
- 최초 성공 시 `nicknameConfirmedAt`을 기록한다.
- 수정 성공 시 현재 User 응답을 반환한다.
- 중복이면 `409 NICKNAME_ALREADY_EXISTS`를 반환한다.

신규 카카오 로그인 사용자는 소셜 표시명을 기본값으로 보지만 이 API가 성공하기 전 테니스 프로필 온보딩을 시작할 수 없다.

## 8. 지역 API

### 8.1 지역 목록 조회

```http
GET /api/v1/regions?parentCode=SEOUL
```

인증: 필수

응답 `200 OK`:

```json
{
  "items": [
    {
      "code": "SEOUL-MAPO",
      "name": "마포구",
      "parent": {
        "code": "SEOUL",
        "name": "서울"
      }
    }
  ]
}
```

- `active = true`인 지역만 반환한다.
- `parentCode`를 생략하면 최상위 지역을 반환한다.
- `query`를 보내면 전국의 활성 시·군·구를 이름 기준으로 검색하며, 응답에 상위 시·도 표시명을 함께 반환한다.
- 지역 데이터는 자주 바뀌지 않으므로 짧은 서버 캐시를 적용할 수 있다.

## 9. 테니스 프로필 API

### 9.1 프로필 생성·온보딩 완료

```http
PUT /api/v1/me/tennis-profile
```

인증: 필수

요청:

```json
{
  "experienceRange": "MONTHS_6_TO_12",
  "rallyLevel": "COMFORTABLE_RALLY",
  "gameExperience": "NONE",
  "playPurposes": ["RALLY_PRACTICE", "CASUAL_HIT"],
  "activityRegionCode": "SEOUL-MAPO",
  "nearbyRegionAllowed": true,
  "expectedVersion": null
}
```

규칙:

- 닉네임 확인이 완료되어야 하며 아니면 `403 NICKNAME_CONFIRMATION_REQUIRED`다.
- 최초 생성은 `expectedVersion = null`이다.
- 수정은 현재 `expectedVersion`을 보낸다.
- `playPurposes`는 1~2개이며 중복될 수 없다.
- `activityRegionCode`는 활성화된 시·군·구 한 곳이어야 한다.
- `nearbyRegionAllowed`은 필수 boolean이다.
- `skillLabel`은 분류 규칙 확정 전 요청으로 받지 않는다.
- Profile, Region 연결, Purpose 연결과 `onboardingCompletedAt`을 한 트랜잭션으로 저장한다.

응답: `TennisProfileView`

주요 오류:

| 코드 | HTTP | 상황 |
| --- | ---: | --- |
| `INVALID_REGION` | 422 | 없거나 비활성 지역 |
| `TOO_MANY_PLAY_PURPOSES` | 422 | 플레이 목적 2개 초과 |
| `VERSION_CONFLICT` | 409 | 수정 중 프로필이 변경됨 |

`PUT`을 사용하지만 최초 생성과 수정은 동일한 자원 표현을 저장하므로 같은 경로를 사용한다.

## 10. 매칭 탐색 API

### 10.1 추천 매칭 조회

```http
GET /api/v1/matches/recommended?limit=5
```

인증 및 온보딩: 필수

응답: `MatchCardView` 목록

후보 조건:

- `status = OPEN`
- `startsAt > now`
- 남은 자리가 1개 이상
- 본인이 만든 매칭 제외
- 이미 신청한 매칭은 추천 기본 목록에서 제외하되, 별도 정책이 필요하면 변경

초기 점수 기준:

| 조건 | 점수 예시 |
| --- | ---: |
| 랠리 수준 동일 | +40 |
| 랠리 수준 인접 | +25 |
| 플레이 목적 일치 | +30 |
| 활동 지역 동일 | +20 |
| 게임 경험 유사 | +10 |

동점은 `startsAt ASC`, `id ASC`로 정렬하는 권장안을 사용한다. 정확한 가중치는 구현 전에 테스트 데이터로 확정하며 API에는 점수를 노출하지 않는다.

추천 이유 code 후보:

```text
SAME_RALLY_LEVEL | NEAR_RALLY_LEVEL | SAME_PLAY_PURPOSE | SAME_REGION | SIMILAR_GAME_EXPERIENCE | BEGINNER_WELCOME
```

### 10.2 매칭 목록 조회

```http
GET /api/v1/matches?regionCode=SEOUL-MAPO&playPurpose=RALLY_PRACTICE&startsFrom=2026-08-12T00:00:00.000Z&cursor=...&limit=20
```

인증 및 온보딩: Core MVP 권장안은 필수

쿼리:

| 이름 | 필수 | 설명 |
| --- | ---: | --- |
| `regionCode` | X | 활성 지역 코드 |
| `playPurpose` | X | PlayPurpose 한 개 |
| `startsFrom` | X | 이 시각 이후 시작, 기본값 `now` |
| `cursor` | X | 다음 페이지 cursor |
| `limit` | X | 기본 20, 최대 50 |

Core 목록은 `OPEN`, 미래 일정, 남은 자리 있음만 반환하고 `startsAt ASC`, `id ASC`로 정렬한다.

### 10.3 매칭 상세 조회

```http
GET /api/v1/matches/{matchId}
```

인증 및 온보딩: Core MVP 권장안은 필수

응답: `MatchDetailView`

- 취소·완료·성사 없이 종료된 매칭도 권한이 있는 모집자와 신청자는 이력에서 상세를 볼 수 있다.
- 일반 목록에서 종료 상태를 노출할지는 별도 탐색 정책으로 정한다.
- `viewer`는 로그인 사용자와 현재 Application 상태를 기준으로 서버가 계산한다.
- 추천 이유가 없으면 빈 배열을 반환한다.

## 11. 매칭 등록·관리 API

### 11.1 외부 예약 코트 매칭 등록

```http
POST /api/v1/matches
```

인증 및 온보딩: 필수

요청:

```json
{
  "clientRequestId": "0198d5a2-51f5-7be2-a044-6f68d37e61d1",
  "title": "천천히 랠리 연습해요",
  "startsAt": "2026-08-22T01:00:00.000Z",
  "endsAt": "2026-08-22T03:00:00.000Z",
  "regionCode": "SEOUL-MAPO",
  "courtSource": "EXTERNAL_RESERVED",
  "externalCourt": {
    "name": "마포 테니스장",
    "address": "서울 마포구 ...",
    "courtNumber": "2번 코트"
  },
  "recruitCount": 2,
  "playPurposes": ["RALLY_PRACTICE"],
  "partnerPreference": "COMPLETE_BEGINNER_WELCOME",
  "totalCourtFeeKrw": 40000,
  "additionalCostNote": "조명비 포함",
  "introduction": "빠르지 않게 편하게 쳐요.",
  "contactOpenChatUrl": "https://open.kakao.com/o/example"
}
```

서버 파생 값:

- `hostUserId`: 세션 User
- `status`: `OPEN`
- `beginnerWelcome`: `partnerPreference`로 계산
- `estimatedTotalParticipants`: `recruitCount + 1`
- `estimatedFeePerPersonKrw`: 전체 비용과 예상 총 참여 인원으로 나눈 뒤 1원 단위 올림
- `version`: 1

검증:

- 제목 1~80자
- `clientRequestId`는 UUID이며 모집자별 유일
- `startsAt < endsAt`이며 시작은 현재보다 미래
- 활성 `regionCode`
- `courtSource = EXTERNAL_RESERVED`
- 코트명 1~100자, 주소 1~255자, 코트 번호 최대 50자
- 코트 번호에 예약번호나 연락처를 넣지 않도록 클라이언트에서 안내하고 서버에서도 명백한 형식을 제한
- `recruitCount >= 1`
- 플레이 목적 1~2개, 중복 불가
- 전체 코트 비용 0 이상
- 추가 비용 안내 최대 200자, 소개 최대 300자
- `contactOpenChatUrl`은 HTTPS이고 host가 정확히 `open.kakao.com`인 URL

응답 `201 Created`: `MatchDetailView`

`Location: /api/v1/matches/{matchId}` 헤더를 제공한다.

같은 모집자가 동일한 `clientRequestId`로 재요청하면 요청 내용이 같을 때 기존 Match를 `200 OK`로 반환한다. 내용이 다르면 `409 IDEMPOTENCY_KEY_REUSED`를 반환한다.

### 11.2 내가 만든 매칭 목록

```http
GET /api/v1/me/hosted-matches?status=OPEN&cursor=...&limit=20
```

인증: 필수

`status`는 선택이며 여러 상태를 쉼표로 전달할 수 있다.

각 항목은 `MatchCardView`에 다음 필드를 추가한다.

```json
{
  "pendingApplicationCount": 2,
  "acceptedCount": 1
}
```

정렬 권장안:

1. 검토할 신청이 있는 미래 매칭
2. 그 외 미래 매칭
3. 지난 매칭

각 그룹 안에서는 가까운 일정 우선이다.

### 11.3 매칭 취소

```http
POST /api/v1/matches/{matchId}/cancel
```

인증: 모집자만

요청:

```json
{
  "expectedVersion": 3,
  "reason": null
}
```

Core MVP에서 취소 사유를 필수로 받지 않는다. 서버는 한 트랜잭션에서 다음을 수행한다.

1. 모집자 권한과 Match version을 확인한다.
2. 취소 가능한 상태인지 확인한다.
3. Match를 `CANCELLED`로 전환한다.
4. `PENDING`, `ACCEPTED` Application을 `CANCELLED`로 전환한다.
5. `cancelledAt`을 기록한다.

외부 코트 예약은 자동 취소되지 않으며 응답에도 이를 명시한다.

```json
{
  "id": "0198...",
  "status": "CANCELLED",
  "cancelledAt": "2026-08-13T02:00:00.000Z",
  "notice": "외부에서 예약한 코트는 별도로 취소해야 해요.",
  "version": 4
}
```

주요 오류:

- `403 MATCH_HOST_REQUIRED`
- `409 MATCH_STATE_CONFLICT`
- `409 VERSION_CONFLICT`

### 11.4 조기 모집 마감

```http
POST /api/v1/matches/{matchId}/close
```

인증: 모집자만

요청:

```json
{
  "expectedVersion": 3
}
```

규칙:

- Match가 `OPEN`이어야 한다.
- ACCEPTED 신청이 한 건 이상이어야 한다.
- Match를 `CLOSED`로 바꾸고 `closedAt`을 기록한다.
- 남은 PENDING 신청을 `CANCELLED`로 바꾸고 사용자에게 `모집이 마감됐어요`라고 표시한다.
- CLOSED Match를 다시 OPEN으로 바꾸는 API는 제공하지 않는다.

### 11.5 매칭 완료

```http
POST /api/v1/matches/{matchId}/complete
```

인증: 모집자만

요청:

```json
{
  "expectedVersion": 4
}
```

- Match가 `CLOSED`이고 `endsAt <= now`여야 한다.
- 성공 시 `COMPLETED`, `completedAt`과 증가한 version을 반환한다.
- OPEN·EXPIRED·CANCELLED 또는 일정 종료 전 요청은 `409 MATCH_NOT_COMPLETABLE`이다.

### 11.6 매칭 수정·모집 재개

공개 후 일정·코트 수정과 CLOSED Match의 모집 재개는 참가자에게 미치는 영향이 크므로 Core MVP에서 범용 `PATCH /matches/{id}` 또는 `/reopen` API를 만들지 않는다.

## 12. 신청 API

### 12.1 같이 치기 신청

```http
POST /api/v1/matches/{matchId}/applications
```

인증 및 온보딩: 필수

요청:

```json
{
  "message": "천천히 랠리하고 싶어요."
}
```

`message`는 선택이며 공백 제거 후 최대 200자다.

서버는 트랜잭션 안에서 다음을 검증한다.

1. Match가 존재하고 `OPEN`인지
2. `startsAt > now`인지
3. 신청자가 모집자가 아닌지
4. 동일 Match에 기존 Application이 없는지
5. ACCEPTED 수가 `recruitCount`보다 작은지
6. 신청자 TennisProfile이 완성되어 있는지
7. 신청 당시 profileSnapshot 생성이 가능한지

응답 `201 Created`: `MatchApplicationView`

주요 오류:

| 코드 | HTTP | 상황 |
| --- | ---: | --- |
| `ONBOARDING_REQUIRED` | 403 | 프로필 미완료 |
| `OWN_MATCH_APPLICATION_NOT_ALLOWED` | 409 | 본인 매칭 |
| `APPLICATION_ALREADY_EXISTS` | 409 | 철회·거절 포함 기존 신청 있음 |
| `MATCH_ALREADY_CLOSED` | 409 | 모집 마감 |
| `MATCH_ALREADY_ENDED` | 409 | 시작 시간이 지남 |
| `MATCH_CANCELLED` | 409 | 취소된 매칭 |
| `NO_REMAINING_SPOTS` | 409 | 남은 자리 없음 |

### 12.2 받은 신청 목록

```http
GET /api/v1/matches/{matchId}/applications?status=PENDING&cursor=...&limit=20
```

인증: 해당 Match 모집자만

응답: `MatchApplicationView` 목록

- 기본 정렬은 `createdAt ASC`, `id ASC`다.
- `status`를 생략하면 모든 신청을 반환한다.
- Match 요약과 `pendingApplicationCount`, `acceptedCount`, `remainingSpots`를 목록 메타데이터로 함께 반환할 수 있다.

```json
{
  "match": {
    "id": "0198...",
    "title": "천천히 랠리 연습해요",
    "status": "OPEN",
    "recruitCount": 2,
    "acceptedCount": 1,
    "remainingSpots": 1,
    "version": 3
  },
  "items": [],
  "pageInfo": {
    "nextCursor": null,
    "hasNext": false
  }
}
```

다른 사용자의 신청 목록에는 `404 MATCH_NOT_FOUND`를 반환하여 리소스 존재 여부를 불필요하게 노출하지 않는다.

### 12.3 신청 수락

```http
POST /api/v1/applications/{applicationId}/accept
```

인증: 연결된 Match 모집자만

요청:

```json
{
  "expectedMatchVersion": 3
}
```

서버는 하나의 트랜잭션에서 Match를 잠그거나 version 조건으로 갱신한다.

1. 모집자 권한 확인
2. Match가 `OPEN`인지 확인
3. Application이 `PENDING`인지 확인
4. ACCEPTED 수 재계산
5. 자리가 있으면 Application을 `ACCEPTED`로 변경
6. 정원이 채워지면 Match를 `CLOSED`로 변경
7. Match가 CLOSED가 되면 남아 있는 PENDING 신청을 `CANCELLED`로 변경
8. `decidedAt`과 변경된 Match version 기록

응답:

```json
{
  "application": {
    "id": "0198...",
    "status": "ACCEPTED",
    "decidedAt": "2026-08-13T03:00:00.000Z"
  },
  "match": {
    "id": "0198...",
    "status": "CLOSED",
    "acceptedCount": 2,
    "remainingSpots": 0,
    "version": 4
  }
}
```

주요 오류:

- `403 MATCH_HOST_REQUIRED`
- `409 APPLICATION_STATE_CONFLICT`
- `409 MATCH_STATE_CONFLICT`
- `409 NO_REMAINING_SPOTS`
- `409 VERSION_CONFLICT`

동시에 마지막 자리를 수락하는 두 요청 중 하나만 성공해야 한다.

### 12.4 신청 거절

```http
POST /api/v1/applications/{applicationId}/reject
```

인증: 연결된 Match 모집자만

- `PENDING` 신청만 거절할 수 있다.
- Core MVP에서는 거절 사유를 요청받거나 신청자에게 노출하지 않는다.
- `REJECTED`와 `decidedAt`을 기록한다.
- `WHERE id = :applicationId AND status = 'PENDING'` 조건으로 원자적으로 전환한다.
- Match 정원에 영향을 주지 않으므로 Match version을 변경하지 않는다.

응답: 변경된 `MatchApplicationView`

### 12.5 보낸 신청 목록

```http
GET /api/v1/me/applications?status=PENDING,ACCEPTED&cursor=...&limit=20
```

인증: 필수

- `status`는 쉼표로 여러 값을 전달할 수 있다.
- 기본 정렬은 `createdAt DESC`, `id DESC`다.
- 취소된 Application은 연결 Match 상태를 함께 반환하여 모집자 취소와 성사 없이 종료를 구분한다.
- 응답은 신청자 본인의 `MatchApplicationView` 목록이다.

### 12.6 신청 철회

```http
POST /api/v1/applications/{applicationId}/withdraw
```

인증: 해당 Application 신청자만

요청 본문: 없음

- `PENDING`만 `WITHDRAWN`으로 전환할 수 있다.
- 수락된 신청의 취소에는 사용하지 않는다.
- 철회 후 재신청은 Core MVP에서 허용하지 않는다.
- 성공 시 `withdrawnAt`을 포함한 변경된 `MatchApplicationView`를 반환한다.

주요 오류:

- `403 APPLICATION_OWNER_REQUIRED`
- `409 APPLICATION_STATE_CONFLICT`

## 13. 권한 매트릭스

| API | 비로그인 | 온보딩 전 회원 | 온보딩 완료 회원 | 모집자·신청자 추가 조건 |
| --- | ---: | ---: | ---: | --- |
| `GET /me` | 불가 | 가능 | 가능 | 본인만 |
| `PATCH /me` | 불가 | 가능 | 가능 | 본인만 |
| `GET /regions` | 불가 | 가능 | 가능 | 없음 |
| `PUT /me/tennis-profile` | 불가 | 가능 | 가능 | 본인만 |
| `GET /matches/recommended` | 불가 | 불가 | 가능 | 본인 Match 제외 |
| `GET /matches` | 불가 | 불가 | 가능 | 없음 |
| `GET /matches/{id}` | 불가 | 권장안 불가 | 가능 | 종료 이력은 관련자 중심 |
| `POST /matches` | 불가 | 불가 | 가능 | 세션 User가 모집자 |
| `POST /matches/{id}/applications` | 불가 | 불가 | 가능 | 본인 Match 불가 |
| `GET /matches/{id}/applications` | 불가 | 불가 | 일반 회원 불가 | 해당 Match 모집자만 |
| `POST /applications/{id}/accept` | 불가 | 불가 | 일반 회원 불가 | 해당 Match 모집자만 |
| `POST /applications/{id}/reject` | 불가 | 불가 | 일반 회원 불가 | 해당 Match 모집자만 |
| `POST /applications/{id}/withdraw` | 불가 | 불가 | 일반 회원 불가 | 해당 신청자만 |
| `GET /me/applications` | 불가 | 가능 | 가능 | 본인 신청만 |
| `GET /me/hosted-matches` | 불가 | 가능 | 가능 | 본인 Match만 |
| `POST /matches/{id}/cancel` | 불가 | 불가 | 일반 회원 불가 | 해당 Match 모집자만 |
| `POST /matches/{id}/close` | 불가 | 불가 | 일반 회원 불가 | 해당 Match 모집자·수락자 1명 이상 |
| `POST /matches/{id}/complete` | 불가 | 불가 | 일반 회원 불가 | 해당 Match 모집자·일정 종료 후 |

비로그인 사용자는 서비스 소개와 카카오 로그인 경로만 접근한다.

## 14. 비즈니스 오류 코드

### 14.1 사용자·프로필

| 코드 | 의미 |
| --- | --- |
| `UNAUTHENTICATED` | 로그인 필요 |
| `ACCOUNT_NOT_ACTIVE` | 정지·탈퇴 계정 |
| `ONBOARDING_REQUIRED` | 프로필 완료 필요 |
| `NICKNAME_CONFIRMATION_REQUIRED` | 테니스 질문 전 닉네임 확인 필요 |
| `NICKNAME_ALREADY_EXISTS` | 닉네임 중복 |
| `INVALID_REGION` | 잘못되거나 비활성 지역 |
| `TOO_MANY_PLAY_PURPOSES` | 플레이 목적 최대 개수 초과 |
| `VERSION_CONFLICT` | 리소스가 다른 요청으로 변경됨 |

### 14.2 매칭

| 코드 | 의미 |
| --- | --- |
| `MATCH_NOT_FOUND` | 없거나 조회 권한 없는 매칭 |
| `MATCH_HOST_REQUIRED` | 모집자 권한 필요 |
| `MATCH_ALREADY_CLOSED` | 모집 마감 |
| `MATCH_ALREADY_ENDED` | 시작 시간이 지남 |
| `MATCH_CANCELLED` | 모집자 취소 |
| `MATCH_EXPIRED` | 수락자 없이 성사되지 않고 종료 |
| `MATCH_STATE_CONFLICT` | 현재 상태에서 행동 불가 |
| `MATCH_CLOSE_REQUIRES_ACCEPTED_APPLICATION` | 수락자 없이 조기 마감 시도 |
| `MATCH_NOT_COMPLETABLE` | 완료할 수 없는 상태 또는 시각 |
| `NO_REMAINING_SPOTS` | 남은 자리 없음 |
| `UNSUPPORTED_COURT_SOURCE` | Core에서 지원하지 않는 코트 출처 |
| `IDEMPOTENCY_KEY_REUSED` | 같은 clientRequestId를 다른 내용으로 재사용 |

### 14.3 신청

| 코드 | 의미 |
| --- | --- |
| `APPLICATION_NOT_FOUND` | 없거나 조회 권한 없는 신청 |
| `APPLICATION_ALREADY_EXISTS` | 기존 신청 존재 |
| `OWN_MATCH_APPLICATION_NOT_ALLOWED` | 본인 매칭 신청 |
| `APPLICATION_OWNER_REQUIRED` | 신청자 본인 권한 필요 |
| `APPLICATION_STATE_CONFLICT` | 현재 상태에서 전환 불가 |

## 15. 서버 파생 값과 단일 진실 공급원

| 응답 값 | 계산 기준 | DB에 별도 저장 |
| --- | --- | ---: |
| `beginnerWelcome` | `partnerPreference = COMPLETE_BEGINNER_WELCOME` | 아니요 |
| `estimatedTotalParticipants` | `recruitCount + 1` | 아니요 |
| `estimatedFeePerPersonKrw` | `ceil(totalCourtFeeKrw / estimatedTotalParticipants)` | 아니요 |
| `acceptedCount` | `ACCEPTED` Application 수 | 아니요 |
| `remainingSpots` | `recruitCount - acceptedCount`, 최소 0 | 아니요 |
| `pendingApplicationCount` | `PENDING` Application 수 | 아니요 |
| `court.sourceLabel` | CourtSource 문구 매핑 | 아니요 |
| `statusLabel` | 상태별 사용자 문구 매핑 | 아니요 |
| `recommendationReasons` | 추천 규칙과 현재 사용자 프로필 | 아니요 |
| `viewer.canApply` | 인증·프로필·관계·상태·정원 | 아니요 |
| `viewer.canComplete` | 모집자·CLOSED·`endsAt <= now` | 아니요 |

파생 값은 서버 도메인 계층 한 곳에서 계산해 목록·상세·신청 API가 같은 규칙을 사용하게 한다.

## 16. 트랜잭션과 동시성

### 16.1 신청 생성과 수락

- 신청 생성 시 Match 상태, 시작 시각, 정원과 중복 신청을 같은 처리 흐름에서 검증한다.
- 신청 수락 시 Match row 잠금 또는 원자적 version 갱신을 사용한다.
- Application 상태 갱신과 Match 마감은 같은 트랜잭션에서 처리한다.
- DB 유일 제약과 트랜잭션 실패를 사용자용 `409` 코드로 변환한다.

### 16.2 취소와 자동 상태 전환

- Match 취소와 연결 Application 취소는 같은 트랜잭션에서 처리한다.
- 시작 시각이 지난 `OPEN` Match는 수락자가 있으면 `CLOSED`, 없으면 `EXPIRED`로 전환한다.
- `EXPIRED` 전환 시 `PENDING` Application을 `CANCELLED`로 바꾼다.
- 정원 충족, 조기 마감 또는 수락자가 있는 Match의 시작 시각 도달 시 남은 `PENDING` Application을 `CANCELLED`로 바꾼다.
- 자동 전환 작업이 반복 실행되어도 결과가 달라지지 않아야 한다.

### 16.3 응답 일관성

- 쓰기 성공 응답은 트랜잭션 커밋 후 상태를 기준으로 만든다.
- `acceptedCount`와 `remainingSpots`는 상태 변경과 동일한 데이터 스냅샷에서 계산한다.
- 캐시된 목록이 오래되어도 쓰기 API는 DB 최신 상태로 다시 검증한다.

## 17. 검증 규칙 요약

| 필드 | 규칙 |
| --- | --- |
| `playPurposes` | 1~2개, 중복 불가 |
| `nickname` | 공백 제거 후 2~12자, 한글·영문·숫자, 정규화 후 유일 |
| `activityRegionCode` | 활성 시·군·구 한 곳 |
| `nearbyRegionAllowed` | 필수 boolean |
| `title` | 공백 제거 후 1~80자 |
| `startsAt`, `endsAt` | 미래 시작, 시작 < 종료 |
| `regionCode` | 활성 Region |
| `externalCourt.name` | 1~100자 |
| `externalCourt.address` | 1~255자 |
| `externalCourt.courtNumber` | 최대 50자, 예약번호·연락처 금지 안내 |
| `recruitCount` | 1 이상의 정수 |
| `totalCourtFeeKrw` | 0 이상의 정수 |
| `additionalCostNote` | 최대 200자 |
| `introduction` | 최대 300자 |
| `clientRequestId` | UUID, 모집자별 유일 |
| `contactOpenChatUrl` | HTTPS, host `open.kakao.com`, 최대 500자 |
| Application `message` | 선택, 최대 200자 |

클라이언트와 서버가 같은 Schema 정의를 공유할 수 있더라도 서버 검증을 생략하지 않는다.

## 18. 캐시 정책

| API | 권장 정책 |
| --- | --- |
| `GET /regions` | 짧은 공개 캐시 또는 서버 캐시 가능 |
| 추천 목록 | 사용자별 응답이므로 공유 캐시 금지 |
| 일반 매칭 목록 | 로그인 사용자별 파생 값이 있으면 공유 캐시 금지 |
| 매칭 상세 | `viewer`, 추천 이유가 포함되므로 공유 캐시 금지 |
| 내 프로필·활동 | `private, no-store` |
| 모든 쓰기 API | 캐시 금지 |

닉네임·프로필 수정, 매칭 생성·신청·수락·거절·철회·조기 마감·완료·취소 후 관련 목록과 상세 데이터를 무효화한다.

## 19. 보안과 개인정보

- 사용자 입력 ID로 권한을 신뢰하지 않고 세션 User와 DB 관계를 확인한다.
- 다른 사용자의 이메일, 인증 공급자 ID와 전화번호를 API 응답에 포함하지 않는다.
- 카카오 오픈채팅 링크는 모집자와 ACCEPTED 신청자에게만 반환하고 로그·분석 이벤트·프로필 스냅샷에 넣지 않는다.
- 신청 프로필 스냅샷에는 인증정보와 연락처를 저장하거나 반환하지 않는다.
- 외부 코트 예약 번호와 예약 확인 이미지를 받지 않는다.
- 에러 로그에는 세션·토큰·개인정보와 신청 메시지 원문을 남기지 않는다.
- 사용자 입력 문자열은 길이를 제한하고 출력 시 안전하게 렌더링한다.
- 상태 변경 API에는 CSRF 방어가 적용된 인증 구성을 사용한다.
- 목록 API는 과도한 수집을 막기 위해 요청 제한과 최대 page size를 적용한다.

## 20. 분석 이벤트 경계

분석 이벤트는 API의 성공 여부와 분리한다. 클라이언트 이벤트가 API 상태를 변경하지 않으며, 서버는 핵심 성공 이벤트를 필요할 때만 기록한다.

| 사용자 행동 | 성공 판단 기준 |
| --- | --- |
| 온보딩 완료 | Profile 트랜잭션 커밋 |
| 매칭 등록 | Match 생성 커밋 |
| 같이 치기 신청 | Application 생성 커밋 |
| 신청 수락·거절 | Application 상태 전환 커밋 |
| 신청 철회 | `WITHDRAWN` 전환 커밋 |
| 조기 모집 마감 | Match CLOSED와 PENDING Application 취소 커밋 |
| 매칭 완료 | Match COMPLETED 전환 커밋 |
| 매칭 취소 | Match와 연결 Application 취소 커밋 |

이벤트 이름은 `03-screen-spec.md`를 기준으로 하며 API 요청 수를 사용자 행동 수로 직접 사용하지 않는다.

## 21. Core MVP API 목록

| Method | Path | 목적 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/v1/me` | 현재 사용자·온보딩 상태 | 회원 |
| PATCH | `/api/v1/me` | 닉네임 확인·수정 | 회원 |
| GET | `/api/v1/regions` | 활성 지역 조회 | 회원 |
| PUT | `/api/v1/me/tennis-profile` | 프로필 생성·수정 | 회원 |
| GET | `/api/v1/matches/recommended` | 추천 매칭 | 온보딩 완료 |
| GET | `/api/v1/matches` | 매칭 탐색 | 온보딩 완료 |
| GET | `/api/v1/matches/{matchId}` | 매칭 상세 | 온보딩 완료 |
| POST | `/api/v1/matches` | 외부 예약 코트 매칭 등록 | 온보딩 완료 |
| GET | `/api/v1/me/hosted-matches` | 내가 만든 매칭 | 회원 |
| POST | `/api/v1/matches/{matchId}/close` | 한 명 이상 수락 후 조기 마감 | 모집자 |
| POST | `/api/v1/matches/{matchId}/cancel` | 매칭 취소 | 모집자 |
| POST | `/api/v1/matches/{matchId}/complete` | 일정 종료 후 완료 확인 | 모집자 |
| POST | `/api/v1/matches/{matchId}/applications` | 같이 치기 신청 | 온보딩 완료 |
| GET | `/api/v1/matches/{matchId}/applications` | 받은 신청 | 모집자 |
| POST | `/api/v1/applications/{applicationId}/accept` | 신청 수락 | 모집자 |
| POST | `/api/v1/applications/{applicationId}/reject` | 신청 거절 | 모집자 |
| GET | `/api/v1/me/applications` | 보낸 신청 | 회원 |
| POST | `/api/v1/applications/{applicationId}/withdraw` | 신청 철회 | 신청자 |

## 22. Court Partner Pilot API 확장 방향

이 섹션은 경계 확인용이며 Core MVP 구현 대상이 아니다.

### 22.1 사용자 측 후보 API

```text
GET  /api/v1/partner-courts
GET  /api/v1/partner-courts/{courtId}
GET  /api/v1/partner-courts/{courtId}/slots
POST /api/v1/court-bookings
GET  /api/v1/me/court-bookings
GET  /api/v1/court-bookings/{bookingId}
POST /api/v1/court-bookings/{bookingId}/cancel
POST /api/v1/court-bookings/{bookingId}/matches
```

`POST /court-bookings/{bookingId}/matches`는 `CONFIRMED` 예약만 허용하고, Match의 참가 신청과는 별개의 흐름이다.

### 22.2 운영자 측 후보 API

```text
POST  /api/v1/operator-applications
GET   /api/v1/operator/courts
POST  /api/v1/operator/courts
PATCH /api/v1/operator/courts/{courtId}
GET   /api/v1/operator/courts/{courtId}/slots
POST  /api/v1/operator/courts/{courtId}/slots
PATCH /api/v1/operator/slots/{slotId}
GET   /api/v1/operator/bookings
GET   /api/v1/operator/bookings/{bookingId}
POST  /api/v1/operator/bookings/{bookingId}/approve
POST  /api/v1/operator/bookings/{bookingId}/reject
```

운영자 예약 승인 API는 CourtBooking만 변경한다. 연결 Match의 Application을 수락하지 않는다.

### 22.3 Pilot 전에 확정할 계약

- 운영자 인증과 직원 권한
- 예약 요청의 임시 점유와 만료 시간
- 한 Slot에 여러 대기 요청을 허용할지 여부
- 운영자 승인 후 즉시 확정인지 결제 대기인지
- 사용자·운영자 취소 가능 시점
- 확정 예약 취소 시 연결 Match 처리
- 코트 정보와 운영자 연락처 공개 범위

## 23. Court Commerce API 확장 방향

이 섹션은 구현 대상이 아니다.

후보 범위:

```text
POST /api/v1/court-bookings/{bookingId}/payment-session
GET  /api/v1/payments/{paymentId}
POST /api/v1/payments/webhooks/{provider}
POST /api/v1/payments/{paymentId}/refunds
GET  /api/v1/operator/settlements
GET  /api/v1/operator/settlements/{settlementId}
```

- 결제 세션 생성은 멱등성 키가 필수다.
- 웹훅은 제공자 이벤트 ID로 중복 처리를 막는다.
- 결제 상태, CourtBooking 상태와 CourtSlot 상태를 하나의 enum으로 합치지 않는다.
- 웹훅 서명 검증 전에는 어떤 상태도 변경하지 않는다.
- 결제 제공자와 환불·정산 정책이 확정되기 전에는 상세 요청·응답을 고정하지 않는다.

## 24. API 테스트 시나리오

### 24.1 인증과 권한

1. 비로그인 사용자의 인증 필요 API 호출
2. 온보딩 미완료 사용자의 추천·등록·신청
3. 다른 사용자의 신청 목록 조회
4. 신청자가 수락 API 호출
5. 모집자가 아닌 사용자가 매칭 취소

### 24.2 입력 검증

1. 존재하지 않거나 비활성 지역
2. 플레이 목적 0개·3개·중복 값
3. 주 활동 지역 없음·두 개
4. 과거 시작 시각과 종료가 빠른 일정
5. 0명 모집과 음수 비용
6. 너무 긴 제목·코트명·신청 메시지
7. Core API에 `PARTNER_COURT` 전송
8. 잘못된 clientRequestId와 다른 payload로 키 재사용
9. HTTPS가 아니거나 `open.kakao.com`이 아닌 연락 링크

### 24.3 상태와 동시성

1. 같은 사용자의 신청 두 요청 동시 전송
2. 마지막 자리에 대한 두 수락 요청 동시 전송
3. 신청 생성과 모집 마감이 동시에 발생
4. 수락과 신청 철회가 동시에 발생
5. Match 취소와 신청 수락이 동시에 발생
6. 이미 취소·마감·완료·성사 없이 종료된 Match 신청
7. 오래된 `expectedVersion`으로 상태 변경
8. 자동 상태 전환 작업의 중복 실행
9. 수락자 없이 조기 마감 요청
10. 일정 종료 전 완료 요청과 종료 후 중복 완료 요청

### 24.4 응답과 개인정보

1. 목록·상세의 예상 비용 계산 일치
2. 목록·상세·수락 응답의 남은 자리 계산 일치
3. 프로필 수정 후 받은 신청에서 신청 당시 스냅샷 유지
4. Application 응답에 이메일·연락처·인증 ID가 없는지 확인
5. 직접 예약 코트가 제휴 확인 코트 문구로 표시되지 않는지 확인
6. PENDING·REJECTED 사용자가 오픈채팅 링크를 받지 않는지 확인
7. 모집자와 ACCEPTED 신청자만 오픈채팅 링크를 받는지 확인

## 25. 확정 정책과 남은 확장 계약

Core MVP는 카카오 로그인, 닉네임 확인, 로그인 후 탐색, 수락자 전용 오픈채팅, 조기 마감, 모집자 완료 확인, clientRequestId 멱등성과 1원 단위 비용 올림을 활성 계약으로 사용한다.

| 후속 항목 | Core 처리 | 확장 시 API 영향 |
| --- | --- | --- |
| 공개 후 일정·코트 수정 | 지원하지 않음 | Match PATCH, 변경 이력과 수락자 동의 필요 |
| CLOSED 모집 재개 | 지원하지 않음 | `/reopen`과 대기 신청 복구 정책 필요 |
| 수락 후 참가 취소 | 운영 문의 | 별도 Application 상태·이력·취소 API 필요 |
| 철회·거절 후 재신청 | 지원하지 않음 | 유일 제약·재신청 API 정책 변경 |
| 신고·차단 | 비공개 MVP 운영 문의 | 공개 출시 전 신고 API와 권한 모델 검토 |
| 플레이 상태 이름 | 응답하지 않음 | 분류 규칙 확정 후 DTO 확장 |

## 26. 다음 단계

`06-development-plan.md`에서는 다음 내용을 확정한다.

- 기술 조합과 프로젝트 초기화 범위
- DB migration과 seed 순서
- API·화면 구현 순서
- 핵심 도메인 서비스와 검증 경계
- 자동 상태 전환 방식
- 테스트 전략과 완료 기준
- 각 개발 단계의 시연 가능한 결과물

프로젝트가 초기화되고 실제 실행 명령과 환경 변수가 확정된 후에 `README.md`를 작성한다.
