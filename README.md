# Tennis Mate

테니스 초보자가 실력 차이에 대한 부담을 덜고, 자신과 비슷한 사람을 찾아 함께
칠 약속을 잡도록 돕는 모바일 우선 웹앱입니다.

Core MVP에서는 카카오 로그인·온보딩, 추천 매칭 탐색·상세, 코트 예약 여부를 선택하는
매칭 등록, 신청·수락·거절, 오픈채팅 안내, 모집 마감·취소·완료 처리를 제공합니다.
`COURT_TBD` 매칭은 코트와 비용을 수락된 참가자와 함께 정하는 흐름입니다.

현재는 **M9: 제한된 사용자 테스트 준비** 단계입니다. 참여자 운영 방법과 관찰 양식은
[M9 제한된 사용자 테스트 운영 가이드](docs/07-m9-limited-user-test.md)를 참고하세요.

## 기술 구성

- Node.js 22.12 이상, npm
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4
- PostgreSQL 17, Prisma ORM 7, Zod 4, Vitest 4
- 배포: Vercel + Neon PostgreSQL

## 빠른 시작: 로컬 PostgreSQL

### 1. 준비물

- Node.js 22.12 이상
- Docker Desktop 또는 Docker Engine + Compose
- 카카오 로그인을 시험하려면 [Kakao Developers](https://developers.kakao.com/) 앱의 REST API 키와 Client Secret

### 2. 저장소 복제와 의존성 설치

```bash
git clone https://github.com/jsl0319/tennis-mate.git
cd tennis-mate
npm ci
```

`npm ci`가 끝나면 `postinstall` 스크립트가 Prisma Client를 자동 생성합니다.

### 3. 환경 변수 준비

```bash
cp .env.example .env.local
```

`.env.local`에 로컬 DB와 본인의 카카오 개발용 값을 입력합니다. 실제 키는 절대
커밋하지 않습니다.

```dotenv
DATABASE_URL=postgresql://tennis_mate:tennis_mate@localhost:5432/tennis_mate?schema=public
AUTH_SECRET=<32바이트_이상_무작위_문자열>
AUTH_KAKAO_ID=<카카오_REST_API_키>
AUTH_KAKAO_SECRET=<카카오_Client_Secret>
APP_BASE_URL=http://localhost:3000
```

로컬 Kakao 앱 Redirect URI도 아래 주소로 등록합니다.

```text
http://localhost:3000/api/auth/callback/kakao
```

### 4. DB 초기화와 앱 실행

```bash
docker compose up -d
npm run db:validate
npm run db:migrate:deploy
npm run db:seed
npm run db:seed:m3
npm run dev
```

- 앱: <http://localhost:3000>
- DB 상태: <http://localhost:3000/api/health>

상태 API는 DB 연결에 성공하면 `200`과 `database: "connected"`를 반환합니다.

## Vercel + Neon으로 실행

Vercel 프로젝트 접근 권한이 있는 경우, 연결된 Neon 환경 변수를 가져와 같은
코드를 실행할 수 있습니다.

```bash
vercel link
vercel env pull .env.local --environment=development
npm run db:validate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Neon은 앱 런타임에 풀링된 `DATABASE_URL`을 사용합니다. 마이그레이션은
`DATABASE_URL_UNPOOLED`가 있으면 이를 우선 사용하며, 없으면 일반
`DATABASE_URL`로 동작합니다.

Production 배포는 다음과 같습니다.

```bash
vercel --prod
```

Production Kakao 앱에는 실제 Vercel 도메인의 다음 경로를 Redirect URI로
등록해야 합니다.

```text
https://<your-vercel-domain>/api/auth/callback/kakao
```

## 검증

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

한 번에 모두 실행하려면 다음 명령을 사용합니다.

```bash
npm run check
```

CI도 Node.js 22에서 Prisma Client 생성, 린트, 타입 검사, 테스트, 빌드를
수행합니다.

## 자주 쓰는 DB 명령

```bash
npm run db:generate
npm run db:validate
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:seed
npm run db:seed:m3
npm run db:studio
```

로컬 PostgreSQL 컨테이너를 멈추되 데이터는 유지하려면 다음을 실행합니다.

```bash
docker compose stop
```

## 환경 변수

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | 앱 런타임용 PostgreSQL 연결 문자열 |
| `DATABASE_URL_UNPOOLED` | Neon 마이그레이션용 직접 연결 문자열(선택) |
| `AUTH_SECRET` | Auth.js 세션 서명 비밀값 |
| `AUTH_KAKAO_ID` | 카카오 REST API 키 |
| `AUTH_KAKAO_SECRET` | 카카오 Client Secret |
| `APP_BASE_URL` | 로컬 애플리케이션 기준 URL |

실제 값은 `.env.local` 또는 Vercel 환경 변수로만 관리합니다. `.env.example`은
필수 키를 알리기 위한 빈 템플릿입니다.

## 저장소에 포함하지 않는 파일

`.gitignore`는 실제 환경 변수, Vercel·Neon 연결 정보, `node_modules`, Next.js
빌드 결과, 로컬 에이전트 파일, 생성된 Prisma Client를 제외합니다. 스키마,
마이그레이션, 지역 seed, 문서, CI 설정은 저장소에 포함합니다.

## 주요 구조

```text
src/
  app/                 # App Router 화면과 Route Handler
  features/profile/    # M2 온보딩 화면과 클라이언트 상태
  server/auth/         # 현재 사용자·계정 접근 확인
  server/domain/       # 입력 검증과 프로필 트랜잭션
  server/db/           # Prisma 연결
  server/env.ts        # 환경 변수 검증
prisma/                # 스키마, 마이그레이션, 지역 seed
docs/                  # 제품·화면·데이터·API 설계 문서
.github/workflows/     # CI
```

제품 범위와 정책은 `docs/`, 개발 작업 원칙은 `AGENTS.md`를 기준으로 합니다.
