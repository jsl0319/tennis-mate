"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Camera,
  CheckCircle,
  CurrencyKrw,
  MapPin,
  MagnifyingGlass,
  Minus,
  Plus,
  TennisBall,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { CourtMedia } from "./court-media";

type Region = { code: string; name: string; shortName: string | null };
type CourtImageDraft = { fileName: string; previewUrl: string; uploadId: string };
type CourtPlaceSearchItem = { name: string; address: string; roadAddress: string | null };

type MatchCreateForm = {
  clientRequestId: string;
  date: string;
  startTime: string;
  endTime: string;
  cityCode: string;
  regionCode: string;
  courtName: string;
  address: string;
  courtNumber: string;
  title: string;
  recruitCount: number;
  playPurposes: string[];
  partnerPreference: string;
  totalCourtFeeKrw: string;
  additionalCostNote: string;
  introduction: string;
};

type FormSetter = <Key extends keyof MatchCreateForm>(key: Key, value: MatchCreateForm[Key]) => void;

const purposes = [
  ["CASUAL_HIT", "편하게 공 주고받기", "부담 없이 가볍게 쳐요"],
  ["RALLY_PRACTICE", "랠리", "공을 이어 가는 연습을 해요"],
  ["STROKE_PRACTICE", "스트로크 연습", "특정 샷을 함께 연습해요"],
  ["GAME_INTRO", "게임 입문", "게임을 처음 경험해 봐요"],
  ["GAME", "게임", "가볍게 게임을 즐겨요"],
] as const;

const preferences = [
  ["COMPLETE_BEGINNER_WELCOME", "완전 초보도 좋아요", "처음 오시는 분도 편하게 신청해요"],
  ["SIMILAR_LEVEL", "비슷한 수준이면 좋아요", "비슷한 속도로 연습하고 싶어요"],
  ["GAME_CAPABLE", "게임 가능한 분을 찾아요", "기본 게임 진행이 가능한 분과 쳐요"],
] as const;

const controlClassName = "mt-2 h-13 w-full rounded-2xl border border-[var(--tm-border-default)] bg-white px-4 text-base text-[var(--tm-text-primary)] outline-none transition focus:border-[var(--tm-action-primary)] focus:ring-4 focus:ring-[color:var(--tm-bg-subtle)]";

function apiMessage(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return "등록하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function getTodayDate() {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatSchedule(date: string, startTime: string, endTime: string) {
  if (!date || !startTime || !endTime) return "일시를 선택해 주세요";
  const [year, month, day] = date.split("-");

  return `${year}년 ${Number(month)}월 ${Number(day)}일 · ${startTime}~${endTime}`;
}

function getLabel<Value extends string>(items: readonly (readonly [Value, string, string])[], value: string) {
  return items.find(([item]) => item === value)?.[1] ?? value;
}

function isCourtPlaceSearchItem(value: unknown): value is CourtPlaceSearchItem {
  return typeof value === "object" && value !== null &&
    "name" in value && typeof value.name === "string" &&
    "address" in value && typeof value.address === "string" &&
    "roadAddress" in value && (typeof value.roadAddress === "string" || value.roadAddress === null);
}

export function M4MatchCreate() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [courtImage, setCourtImage] = useState<CourtImageDraft | null>(null);
  const [courtImageError, setCourtImageError] = useState("");
  const [courtImageUploading, setCourtImageUploading] = useState(false);
  const [courtSearchQuery, setCourtSearchQuery] = useState("");
  const [courtSearchResults, setCourtSearchResults] = useState<CourtPlaceSearchItem[]>([]);
  const [courtSearchError, setCourtSearchError] = useState("");
  const [courtSearchLoading, setCourtSearchLoading] = useState(false);
  const [selectedCourtPlace, setSelectedCourtPlace] = useState<CourtPlaceSearchItem | null>(null);
  const [form, setForm] = useState<MatchCreateForm>(() => ({
    clientRequestId: crypto.randomUUID(),
    date: "",
    startTime: "",
    endTime: "",
    cityCode: "",
    regionCode: "",
    courtName: "",
    address: "",
    courtNumber: "",
    title: "",
    recruitCount: 1,
    playPurposes: ["RALLY_PRACTICE"],
    partnerPreference: "COMPLETE_BEGINNER_WELCOME",
    totalCourtFeeKrw: "",
    additionalCostNote: "",
    introduction: "",
  }));

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/v1/regions");
        const body: unknown = await response.json();
        if (!response.ok || typeof body !== "object" || body === null || !("items" in body) || !Array.isArray(body.items)) {
          throw new Error("활동 지역을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.");
        }
        if (active) setCities(body.items as Region[]);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "활동 지역을 불러오지 못했어요.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (courtImage) URL.revokeObjectURL(courtImage.previewUrl);
  }, [courtImage]);

  useEffect(() => {
    const query = courtSearchQuery.trim();
    if (query.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setCourtSearchLoading(true);
        setCourtSearchError("");
        try {
          const response = await fetch(`/api/v1/court-place-search?q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal });
          const body: unknown = await response.json();
          if (!response.ok) throw new Error(apiMessage(body));
          if (typeof body !== "object" || body === null || !("items" in body) || !Array.isArray(body.items)) {
            throw new Error("코트 검색 결과를 다시 불러와 주세요.");
          }
          if (controller.signal.aborted) return;
          setCourtSearchResults(body.items.filter(isCourtPlaceSearchItem));
        } catch (caught) {
          if (controller.signal.aborted) return;
          setCourtSearchResults([]);
          setCourtSearchError(caught instanceof Error ? caught.message : "코트를 검색하지 못했어요. 직접 입력해 주세요.");
        } finally {
          if (!controller.signal.aborted) setCourtSearchLoading(false);
        }
      })();
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [courtSearchQuery]);

  const set: FormSetter = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const expectedPeople = form.recruitCount + 1;
  const totalCourtFee = Number(form.totalCourtFeeKrw);
  const fee = form.totalCourtFeeKrw === "" || !Number.isFinite(totalCourtFee) ? 0 : Math.ceil(totalCourtFee / expectedPeople);

  const selectCity = async (code: string) => {
    setError("");
    set("cityCode", code);
    set("regionCode", "");
    setDistricts([]);
    if (!code) return;

    try {
      const response = await fetch(`/api/v1/regions?parentCode=${encodeURIComponent(code)}`);
      const body: unknown = await response.json();
      if (!response.ok || typeof body !== "object" || body === null || !("items" in body) || !Array.isArray(body.items)) {
        throw new Error("시·군·구를 불러오지 못했어요. 다시 선택해 주세요.");
      }
      setDistricts(body.items as Region[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "시·군·구를 불러오지 못했어요.");
    }
  };

  const togglePurpose = (purpose: string) => {
    setForm((current) => {
      if (current.playPurposes.includes(purpose)) {
        return { ...current, playPurposes: current.playPurposes.filter((item) => item !== purpose) };
      }
      if (current.playPurposes.length === 2) return current;

      return { ...current, playPurposes: [...current.playPurposes, purpose] };
    });
  };

  const updateRecruitCount = (change: number) => {
    setForm((current) => ({ ...current, recruitCount: Math.max(1, current.recruitCount + change) }));
  };

  const selectCourtPlace = (place: CourtPlaceSearchItem) => {
    set("courtName", place.name);
    set("address", place.address);
    setSelectedCourtPlace(place);
    setCourtSearchQuery("");
    setCourtSearchResults([]);
    setCourtSearchError("");
  };

  const updateCourtSearchQuery = (value: string) => {
    setCourtSearchQuery(value);
    setCourtSearchResults([]);
    setCourtSearchError("");
    setCourtSearchLoading(false);
  };

  const uploadCourtImage = async (file: File | null) => {
    if (!file) return;
    setCourtImageError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setCourtImageError("코트 사진은 JPEG, PNG, WebP만 올릴 수 있어요.");
      return;
    }
    if (file.size < 1 || file.size > 4 * 1024 * 1024) {
      setCourtImageError("코트 사진은 4 MiB 이하로 올려 주세요.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCourtImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/court-image-uploads", { method: "POST", body: formData });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      const uploadId = typeof body === "object" && body !== null && "id" in body && typeof body.id === "string" ? body.id : null;
      if (!uploadId) throw new Error("코트 사진을 다시 올려 주세요.");

      setCourtImage((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return { fileName: file.name, previewUrl, uploadId };
      });
    } catch (caught) {
      URL.revokeObjectURL(previewUrl);
      setCourtImageError(caught instanceof Error ? caught.message : "코트 사진을 올리지 못했어요.");
    } finally {
      setCourtImageUploading(false);
    }
  };

  const next = () => {
    setError("");
    if (step === 1 && (!form.date || !form.startTime || !form.endTime || !form.regionCode)) {
      setError("날짜, 시작 시간, 종료 시간, 활동 지역을 모두 선택해 주세요.");
      return;
    }
    if (step === 1 && form.endTime <= form.startTime) {
      setError("종료 시간은 시작 시간보다 늦어야 해요.");
      return;
    }
    if (step === 1 && (!form.courtName.trim() || !form.address.trim())) {
      setError("예약한 코트의 이름과 주소를 입력해 주세요.");
      return;
    }
    if (step === 1 && courtImageUploading) {
      setError("코트 사진을 올리는 중이에요. 잠시만 기다려 주세요.");
      return;
    }
    if (step === 2 && (!form.title.trim() || form.playPurposes.length === 0 || form.recruitCount < 1)) {
      setError("매칭 제목, 모집 인원, 원하는 플레이를 확인해 주세요.");
      return;
    }
    if (step === 3 && (form.totalCourtFeeKrw === "" || !Number.isInteger(totalCourtFee) || totalCourtFee < 0)) {
      setError("전체 코트 비용을 0원 이상의 정수로 입력해 주세요.");
      return;
    }

    setStep((current) => current + 1);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const startsAt = new Date(`${form.date}T${form.startTime}`).toISOString();
      const endsAt = new Date(`${form.date}T${form.endTime}`).toISOString();
      const response = await fetch("/api/v1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: form.clientRequestId,
          title: form.title,
          startsAt,
          endsAt,
          regionCode: form.regionCode,
          courtSource: "EXTERNAL_RESERVED",
          externalCourt: {
            name: form.courtName,
            address: form.address,
            courtNumber: form.courtNumber || null,
            imageUploadId: courtImage?.uploadId ?? null,
          },
          recruitCount: form.recruitCount,
          playPurposes: form.playPurposes,
          partnerPreference: form.partnerPreference,
          totalCourtFeeKrw: totalCourtFee,
          additionalCostNote: form.additionalCostNote || null,
          introduction: form.introduction || null,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      const matchId = typeof body === "object" && body !== null && "id" in body && typeof body.id === "string" ? body.id : null;
      if (!matchId) throw new Error("등록된 매칭 정보를 찾지 못했어요. 목록에서 다시 확인해 주세요.");

      router.push(`/matches/${matchId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "등록하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const action = step === 1 ? "모집 정보 입력" : step === 2 ? "비용 안내 입력" : step === 3 ? "미리보기" : "매칭 공개하기";

  return (
    <main className="min-h-svh bg-[var(--tm-bg-page)] pb-36 text-[var(--tm-text-primary)]">
      <section className="mx-auto max-w-[560px]">
        <header className="sticky top-0 z-20 border-b border-[var(--tm-border-subtle)] bg-[var(--tm-bg-page)]/95 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              aria-label={step === 1 ? "이전 화면으로 돌아가기" : "이전 단계"}
              className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--tm-text-primary)] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-action-primary)]"
              onClick={() => (step === 1 ? router.replace("/") : setStep((current) => current - 1))}
              type="button"
            >
              <ArrowLeft aria-hidden size={25} weight="bold" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--tm-text-primary)]">매칭 만들기</p>
              <p className="mt-0.5 text-xs text-[var(--tm-text-secondary)]">{step} / 4 단계</p>
            </div>
          </div>
          <div aria-label="매칭 등록 진행" aria-valuemax={4} aria-valuemin={1} aria-valuenow={step} className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--tm-border-default)]" role="progressbar">
            <div className="h-full rounded-full bg-[var(--tm-action-primary)] transition-[width] duration-300" style={{ width: `${step * 25}%` }} />
          </div>
        </header>

        <div className="px-5 pt-7">
          {step === 1 ? (
            <StepOne
              cities={cities}
              courtImage={courtImage}
              courtImageError={courtImageError}
              courtImageUploading={courtImageUploading}
              districts={districts}
              form={form}
              onCourtImageChange={(file) => void uploadCourtImage(file)}
              onCourtNameChange={(value) => { set("courtName", value); setSelectedCourtPlace(null); }}
              onCourtAddressChange={(value) => { set("address", value); setSelectedCourtPlace(null); }}
              onCourtPlaceQueryChange={updateCourtSearchQuery}
              onCourtPlaceSelect={selectCourtPlace}
              onSelectCity={(code) => void selectCity(code)}
              courtSearchError={courtSearchError}
              courtSearchLoading={courtSearchLoading}
              courtSearchQuery={courtSearchQuery}
              courtSearchResults={courtSearchResults}
              selectedCourtPlace={selectedCourtPlace}
              set={set}
            />
          ) : null}
          {step === 2 ? <StepTwo form={form} onRecruitChange={updateRecruitCount} onTogglePurpose={togglePurpose} set={set} /> : null}
          {step === 3 ? <StepThree expectedPeople={expectedPeople} fee={fee} form={form} set={set} /> : null}
          {step === 4 ? <StepFour courtImage={courtImage} expectedPeople={expectedPeople} fee={fee} form={form} /> : null}

          {error ? (
            <p className="mt-5 rounded-2xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm leading-6 text-[var(--tm-status-error-text)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <ActionFooter
          action={action}
          disabled={saving || courtImageUploading}
          onBack={step === 1 ? undefined : () => setStep((current) => current - 1)}
          onNext={() => (step < 4 ? next() : void submit())}
          saving={saving}
          uploading={courtImageUploading}
        />
      </section>
    </main>
  );
}

function StepOne({
  cities,
  courtImage,
  courtImageError,
  courtImageUploading,
  districts,
  form,
  onCourtImageChange,
  onCourtAddressChange,
  onCourtNameChange,
  onCourtPlaceQueryChange,
  onCourtPlaceSelect,
  onSelectCity,
  courtSearchError,
  courtSearchLoading,
  courtSearchQuery,
  courtSearchResults,
  selectedCourtPlace,
  set,
}: {
  cities: Region[];
  courtImage: CourtImageDraft | null;
  courtImageError: string;
  courtImageUploading: boolean;
  districts: Region[];
  form: MatchCreateForm;
  onCourtImageChange: (file: File | null) => void;
  onCourtAddressChange: (value: string) => void;
  onCourtNameChange: (value: string) => void;
  onCourtPlaceQueryChange: (value: string) => void;
  onCourtPlaceSelect: (place: CourtPlaceSearchItem) => void;
  onSelectCity: (code: string) => void;
  courtSearchError: string;
  courtSearchLoading: boolean;
  courtSearchQuery: string;
  courtSearchResults: CourtPlaceSearchItem[];
  selectedCourtPlace: CourtPlaceSearchItem | null;
  set: FormSetter;
}) {
  return (
    <div>
      <StepIntro eyebrow="외부 예약 코트" title={<>예약한 코트에서<br />함께 칠 사람을 찾아요</>} description="코트 정보와 시간을 먼저 알려 주세요. 같이 칠 분이 일정을 쉽게 확인할 수 있어요." />

      <section className="mt-6 rounded-3xl border border-[var(--tm-border-default)] bg-[var(--tm-bg-subtle)] p-5">
        <div className="flex gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[var(--tm-action-primary)] shadow-sm">
            <TennisBall aria-hidden size={24} weight="fill" />
          </span>
          <div>
            <h2 className="font-bold text-[var(--tm-action-primary)]">아직 코트를 예약하지 않았나요?</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--tm-text-secondary)]">운영자가 준비한 시간으로 코트 매칭을 열 수 있어요.</p>
            <Link className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-xl bg-white px-3 text-sm font-semibold text-[var(--tm-action-primary)] ring-1 ring-inset ring-[var(--tm-border-default)]" href="/partner-sessions">
              코트 매칭 둘러보기 <ArrowRight aria-hidden size={15} weight="bold" />
            </Link>
          </div>
        </div>
      </section>

      <FormPanel description="예약한 시작·종료 시간을 그대로 선택해 주세요. 2시간을 넘는 일정도 등록할 수 있어요." icon={<CalendarBlank aria-hidden size={23} weight="fill" />} title="언제 칠까요?">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <FieldTitle required>매칭 날짜</FieldTitle>
            <input className={controlClassName} min={getTodayDate()} onChange={(event) => set("date", event.target.value)} type="date" value={form.date} />
          </label>
          <label>
            <FieldTitle required>시작 시간</FieldTitle>
            <input className={controlClassName} onChange={(event) => set("startTime", event.target.value)} type="time" value={form.startTime} />
          </label>
          <label>
            <FieldTitle required>종료 시간</FieldTitle>
            <input className={controlClassName} min={form.startTime || undefined} onChange={(event) => set("endTime", event.target.value)} type="time" value={form.endTime} />
          </label>
        </div>
        <p className="mt-4 rounded-2xl bg-[var(--tm-bg-subtle)] px-4 py-3 text-xs leading-5 text-[var(--tm-text-secondary)]">종료 시간은 시작 시간보다 늦게 선택해 주세요. 자정을 넘는 일정은 현재 등록할 수 없어요.</p>
      </FormPanel>

      <FormPanel description="참가자가 이동 거리를 가늠할 수 있도록 활동 지역을 선택해 주세요." icon={<MapPin aria-hidden size={23} weight="fill" />} title="어디에서 칠까요?">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <FieldTitle required>시·도</FieldTitle>
            <select aria-label="시·도 선택" className={controlClassName} onChange={(event) => onSelectCity(event.target.value)} value={form.cityCode}>
              <option value="">선택</option>
              {cities.map((city) => <option key={city.code} value={city.code}>{city.shortName ?? city.name}</option>)}
            </select>
          </label>
          <label>
            <FieldTitle required>시·군·구</FieldTitle>
            <select aria-label="시·군·구 선택" className={controlClassName} disabled={!form.cityCode} onChange={(event) => set("regionCode", event.target.value)} value={form.regionCode}>
              <option value="">선택</option>
              {districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}
            </select>
          </label>
        </div>
        <CourtPlaceSearch
          error={courtSearchError}
          isLoading={courtSearchLoading}
          onQueryChange={onCourtPlaceQueryChange}
          onSelect={onCourtPlaceSelect}
          query={courtSearchQuery}
          results={courtSearchResults}
          selectedPlace={selectedCourtPlace}
        />
        <p className="mt-5 text-sm font-bold text-[var(--tm-text-secondary)]">또는 직접 입력</p>
        <label className="mt-4 block">
          <FieldTitle required>코트장 이름</FieldTitle>
          <input className={controlClassName} maxLength={100} onChange={(event) => onCourtNameChange(event.target.value)} placeholder="예: 한강 테니스장" value={form.courtName} />
        </label>
        <label className="mt-4 block">
          <FieldTitle required>코트장 주소</FieldTitle>
          <input className={controlClassName} maxLength={255} onChange={(event) => onCourtAddressChange(event.target.value)} placeholder="참가자가 찾아올 수 있는 주소" value={form.address} />
        </label>
        <label className="mt-4 block">
          <FieldTitle>코트 번호 <span className="font-normal text-[var(--tm-text-secondary)]">(선택)</span></FieldTitle>
          <input className={controlClassName} maxLength={50} onChange={(event) => set("courtNumber", event.target.value)} placeholder="예: 3번 코트" value={form.courtNumber} />
        </label>
        <p className="mt-3 rounded-2xl bg-[var(--tm-bg-subtle)] px-4 py-3 text-xs leading-5 text-[var(--tm-text-secondary)]">예약번호와 연락처는 입력하지 마세요. 코트 번호만 간단히 알려 주세요.</p>
      </FormPanel>

      <CourtImageUpload courtImage={courtImage} error={courtImageError} isUploading={courtImageUploading} onChange={onCourtImageChange} />
    </div>
  );
}

function CourtPlaceSearch({ error, isLoading, onQueryChange, onSelect, query, results, selectedPlace }: { error: string; isLoading: boolean; onQueryChange: (value: string) => void; onSelect: (place: CourtPlaceSearchItem) => void; query: string; results: CourtPlaceSearchItem[]; selectedPlace: CourtPlaceSearchItem | null }) {
  const isQueryReady = query.trim().length >= 2;

  return (
    <section className="mt-5 rounded-2xl border border-[var(--tm-border-default)] bg-[var(--tm-bg-subtle)] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--tm-action-primary)]">
          <MagnifyingGlass aria-hidden size={20} weight="bold" />
        </span>
        <div>
          <h3 className="text-sm font-bold">테니스장 검색 <span className="font-normal text-[var(--tm-text-secondary)]">(선택)</span></h3>
          <p className="mt-1 text-xs leading-5 text-[var(--tm-text-secondary)]">이름이나 동네를 두 글자 이상 입력하면 실제 장소를 찾아드려요.</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="sr-only">테니스장 검색</span>
        <div className="relative">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--tm-text-secondary)]" size={19} />
          <input aria-label="테니스장 검색" className="h-12 w-full rounded-xl border border-[var(--tm-border-default)] bg-white py-2 pl-11 pr-4 text-sm outline-none transition focus:border-[var(--tm-action-primary)] focus:ring-4 focus:ring-white" maxLength={80} onChange={(event) => onQueryChange(event.target.value)} placeholder="예: 마포 테니스장, 잠실" value={query} />
        </div>
      </label>

      {isLoading ? <p className="mt-3 text-xs text-[var(--tm-text-secondary)]">테니스장을 찾고 있어요…</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-[var(--tm-status-error-text)]" role="alert">{error}</p> : null}
      {isQueryReady && !isLoading && !error && results.length === 0 ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-[var(--tm-text-secondary)]">찾는 테니스장이 없나요? 아래에 이름과 주소를 직접 입력해 주세요.</p> : null}
      {results.length ? (
        <div aria-label="테니스장 검색 결과" className="mt-3 grid gap-2">
          {results.map((place, index) => (
            <button aria-label={`${place.name} 선택`} className="rounded-xl bg-white px-3 py-3 text-left shadow-sm ring-1 ring-inset ring-[var(--tm-border-default)] transition hover:ring-[var(--tm-action-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-action-primary)]" key={`${place.name}-${place.address}-${index}`} onClick={() => onSelect(place)} type="button">
              <strong className="block text-sm">{place.name}</strong>
              <span className="mt-1 block text-xs leading-5 text-[var(--tm-text-secondary)]">{place.roadAddress ?? place.address}</span>
            </button>
          ))}
        </div>
      ) : null}
      {selectedPlace ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-[var(--tm-action-primary)]"><CheckCircle aria-hidden className="mr-1 inline-block align-text-bottom" size={15} weight="fill" />검색한 장소 정보를 입력했어요. 필요하면 직접 수정할 수 있어요.</p> : null}
      <p className="mt-3 text-[11px] leading-5 text-[var(--tm-text-secondary)]">장소 정보 제공: Kakao · 검색 결과는 코트 예약 여부나 운영 상태를 보증하지 않아요.</p>
    </section>
  );
}

function CourtImageUpload({ courtImage, error, isUploading, onChange }: { courtImage: CourtImageDraft | null; error: string; isUploading: boolean; onChange: (file: File | null) => void }) {
  const previewLabel = isUploading ? "사진 올리는 중…" : "선택한 코트 사진";

  return (
    <FormPanel description="사진이 있으면 함께 칠 분이 코트를 더 쉽게 알아볼 수 있어요." icon={<Camera aria-hidden size={23} weight="fill" />} title={<>코트 사진 <span className="text-base font-normal text-[var(--tm-text-secondary)]">(선택)</span></>}>
      {courtImage ? (
        <CourtMedia alt="선택한 코트 사진 미리보기" className="aspect-[350/212] w-full" fallbackLabel="코트 사진을 선택해 보세요" image={null} previewLabel={previewLabel} previewUrl={courtImage.previewUrl} />
      ) : (
        <CourtMedia alt="코트 사진을 선택할 수 있는 영역" className="aspect-[350/212] w-full" fallbackLabel="코트 사진을 선택해 보세요" image={null} />
      )}
      <label className={`mt-4 flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--tm-border-default)] bg-white px-4 text-sm font-bold text-[var(--tm-text-primary)] transition hover:border-[var(--tm-action-primary)] ${isUploading ? "cursor-wait opacity-60" : ""}`}>
        <Camera aria-hidden size={19} weight="bold" />
        <span>{isUploading ? "사진 올리는 중…" : courtImage ? "사진 바꾸기" : "사진 선택하기"}</span>
        <input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isUploading} onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; event.currentTarget.value = ""; onChange(file); }} type="file" />
      </label>
      <p className="mt-3 text-xs leading-5 text-[var(--tm-text-secondary)]">JPEG · PNG · WebP · 최대 4MB<br />사진에 얼굴, 연락처, 예약번호가 보이지 않는지 확인해 주세요.</p>
      {courtImage ? <p className="mt-2 truncate text-xs text-[var(--tm-text-secondary)]">선택한 파일: {courtImage.fileName}</p> : null}
      {error ? <p className="mt-3 rounded-2xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm leading-6 text-[var(--tm-status-error-text)]" role="alert">{error}</p> : null}
    </FormPanel>
  );
}

function StepTwo({ form, onRecruitChange, onTogglePurpose, set }: { form: MatchCreateForm; onRecruitChange: (change: number) => void; onTogglePurpose: (value: string) => void; set: FormSetter }) {
  const expectedPeople = form.recruitCount + 1;

  return (
    <div>
      <StepIntro eyebrow="모집 정보" title="어떤 테니스를 함께할까요?" description="플레이 방식과 모집 인원을 알려 주면, 신청할 분이 더 편하게 판단할 수 있어요." />

      <FormPanel description="짧고 자연스러운 제목이 좋아요." icon={<TennisBall aria-hidden size={23} weight="fill" />} title="매칭 제목">
        <label>
          <FieldTitle required>제목</FieldTitle>
          <input className={controlClassName} maxLength={80} onChange={(event) => set("title", event.target.value)} placeholder="예: 주말에 편하게 공 주고받아요" value={form.title} />
          <span className="mt-2 block text-right text-xs text-[var(--tm-text-secondary)]">{form.title.length} / 80</span>
        </label>
      </FormPanel>

      <FormPanel description="모집자를 제외하고 함께 칠 인원을 정해 주세요." icon={<UsersThree aria-hidden size={23} weight="fill" />} title="몇 명과 함께할까요?">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--tm-border-default)] bg-white p-3">
          <div>
            <p className="text-sm font-bold">추가 모집 인원</p>
            <p className="mt-1 text-xs text-[var(--tm-text-secondary)]">나를 포함해 총 {expectedPeople}명이 함께해요</p>
          </div>
          <div className="flex items-center gap-3">
            <button aria-label="모집 인원 줄이기" className="grid size-10 place-items-center rounded-xl border border-[var(--tm-border-default)] disabled:opacity-40" disabled={form.recruitCount <= 1} onClick={() => onRecruitChange(-1)} type="button"><Minus aria-hidden size={17} weight="bold" /></button>
            <output aria-label={`추가 모집 인원 ${form.recruitCount}명`} className="min-w-7 text-center text-lg font-bold">{form.recruitCount}</output>
            <button aria-label="모집 인원 늘리기" className="grid size-10 place-items-center rounded-xl bg-[var(--tm-action-primary)] text-white" onClick={() => onRecruitChange(1)} type="button"><Plus aria-hidden size={17} weight="bold" /></button>
          </div>
        </div>
      </FormPanel>

      <FormPanel description="최대 두 가지를 골라 주세요." icon={<TennisBall aria-hidden size={23} weight="fill" />} title="원하는 플레이">
        <div className="grid gap-3 sm:grid-cols-2">
          {purposes.map(([code, label, description]) => <ChoiceCard description={description} key={code} onClick={() => onTogglePurpose(code)} selected={form.playPurposes.includes(code)}>{label}</ChoiceCard>)}
        </div>
      </FormPanel>

      <FormPanel description="실력 수치 대신, 함께하고 싶은 분위기를 골라 주세요." icon={<UsersThree aria-hidden size={23} weight="fill" />} title="원하는 상대">
        <div className="grid gap-3">
          {preferences.map(([value, label, description]) => <ChoiceCard description={description} key={value} onClick={() => set("partnerPreference", value)} selected={form.partnerPreference === value}>{label}</ChoiceCard>)}
        </div>
      </FormPanel>
    </div>
  );
}

function StepThree({ expectedPeople, fee, form, set }: { expectedPeople: number; fee: number; form: MatchCreateForm; set: FormSetter }) {
  return (
    <div>
      <StepIntro eyebrow="비용과 안내" title="참가자가 궁금할 내용을 알려주세요" description="비용은 예상 금액으로 안내돼요. Rally On에서 결제하거나 나누어 받지는 않아요." />

      <FormPanel description="예약할 때 확인한 전체 코트 이용료를 입력해 주세요." icon={<CurrencyKrw aria-hidden size={23} weight="bold" />} title="코트 비용">
        <label>
          <FieldTitle required>전체 코트 비용</FieldTitle>
          <div className="relative">
            <input className={`${controlClassName} pr-12`} inputMode="numeric" min="0" onChange={(event) => set("totalCourtFeeKrw", event.target.value)} placeholder="예: 24,000" type="number" value={form.totalCourtFeeKrw} />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-bold text-[var(--tm-text-secondary)]">원</span>
          </div>
        </label>
        <div className="mt-4 rounded-2xl bg-[var(--tm-bg-subtle)] p-4">
          <p className="text-sm text-[var(--tm-text-secondary)]">예상 1인 비용</p>
          <p className="mt-1 text-xl font-bold text-[var(--tm-action-primary)]">약 {fee.toLocaleString("ko-KR")}원</p>
          <p className="mt-2 text-xs leading-5 text-[var(--tm-text-secondary)]">전체 비용 ÷ 예상 총 {expectedPeople}명, 1원 단위 올림으로 계산해요.</p>
        </div>
        <p className="mt-3 rounded-2xl bg-[var(--tm-bg-subtle)] px-4 py-3 text-xs leading-5 text-[var(--tm-text-secondary)]">Rally On은 코트 비용을 결제하거나 정산하지 않아요. 비용 분담은 참가자끼리 따로 정해요.</p>
      </FormPanel>

      <FormPanel description="준비물이나 별도 비용이 있다면 짧게 알려 주세요." title={<>추가 비용 안내 <span className="text-base font-normal text-[var(--tm-text-secondary)]">(선택)</span></>}>
        <label>
          <FieldTitle>안내</FieldTitle>
          <input className={controlClassName} maxLength={200} onChange={(event) => set("additionalCostNote", event.target.value)} placeholder="예: 테니스공은 각자 준비해요" value={form.additionalCostNote} />
          <span className="mt-2 block text-right text-xs text-[var(--tm-text-secondary)]">{form.additionalCostNote.length} / 200</span>
        </label>
      </FormPanel>

      <FormPanel description="처음 신청하는 분도 편하게 알 수 있도록 적어 주세요." title={<>소개 <span className="text-base font-normal text-[var(--tm-text-secondary)]">(선택)</span></>}>
        <label>
          <FieldTitle>소개</FieldTitle>
          <textarea className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-[var(--tm-border-default)] bg-white p-4 text-base outline-none transition focus:border-[var(--tm-action-primary)] focus:ring-4 focus:ring-[color:var(--tm-bg-subtle)]" maxLength={300} onChange={(event) => set("introduction", event.target.value)} placeholder="예: 천천히 랠리하면서 즐겁게 연습할 분을 찾아요. 처음 게임을 해봐도 괜찮아요!" value={form.introduction} />
          <span className="mt-2 block text-right text-xs text-[var(--tm-text-secondary)]">{form.introduction.length} / 300</span>
        </label>
        <p className="mt-4 rounded-2xl bg-[var(--tm-bg-subtle)] px-4 py-3 text-sm leading-6 text-[var(--tm-action-hover)]">수락된 참가자와 서비스 내 채팅에서 당일 준비를 조율해요.</p>
      </FormPanel>
    </div>
  );
}

function StepFour({ courtImage, expectedPeople, fee, form }: { courtImage: CourtImageDraft | null; expectedPeople: number; fee: number; form: MatchCreateForm }) {
  const regionText = [form.courtName, form.address].filter(Boolean).join(" · ");

  return (
    <div>
      <StepIntro eyebrow="공개 전 확인" title="이렇게 모집할까요?" description="공개하면 매칭 목록에 보여지고, 원할 때 참가 신청을 받을 수 있어요." />

      <article className="mt-6 overflow-hidden rounded-3xl border border-[var(--tm-border-default)] bg-white shadow-[0_12px_30px_rgba(29,50,84,0.08)]">
        {courtImage ? <CourtMedia alt="등록할 코트 사진 미리보기" className="aspect-[350/180] w-full rounded-none" fallbackLabel="등록할 코트" image={null} previewLabel="등록할 코트 사진" previewUrl={courtImage.previewUrl} /> : null}
        <div className="p-5">
          <p className="inline-flex rounded-full bg-[var(--tm-bg-subtle)] px-3 py-1.5 text-xs font-bold text-[var(--tm-action-primary)]">모집자가 코트를 예약했어요</p>
          <h2 className="mt-3 text-xl font-bold leading-7">{form.title}</h2>
          <dl className="mt-5 grid gap-4">
            <PreviewItem icon={<CalendarBlank aria-hidden size={19} weight="fill" />} label="일시" value={formatSchedule(form.date, form.startTime, form.endTime)} />
            <PreviewItem icon={<MapPin aria-hidden size={19} weight="fill" />} label="코트" value={regionText || "코트 정보를 입력해 주세요"} />
            <PreviewItem icon={<UsersThree aria-hidden size={19} weight="fill" />} label="모집" value={`추가 ${form.recruitCount}명 · 총 ${expectedPeople}명 예정`} />
            <PreviewItem icon={<CurrencyKrw aria-hidden size={19} weight="bold" />} label="예상 1인 비용" value={`약 ${fee.toLocaleString("ko-KR")}원`} />
          </dl>
          <div className="mt-5 border-t border-[var(--tm-border-subtle)] pt-4">
            <p className="text-sm font-bold">함께하고 싶은 플레이</p>
            <p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">{form.playPurposes.map((purpose) => getLabel(purposes, purpose)).join(" · ")}<br />{getLabel(preferences, form.partnerPreference)}</p>
            {form.partnerPreference === "COMPLETE_BEGINNER_WELCOME" ? <p className="mt-3 inline-flex rounded-full bg-[var(--tm-bg-subtle)] px-3 py-1.5 text-xs font-bold text-[var(--tm-action-primary)]">초보자 환영</p> : null}
            {form.additionalCostNote ? <p className="mt-3 rounded-2xl bg-[var(--tm-bg-subtle)] px-3 py-2 text-xs leading-5 text-[var(--tm-text-secondary)]">추가 안내: {form.additionalCostNote}</p> : null}
            {form.introduction ? <p className="mt-3 text-sm leading-6 text-[var(--tm-text-secondary)]">{form.introduction}</p> : null}
          </div>
          <p className="mt-5 rounded-2xl bg-[var(--tm-bg-subtle)] px-4 py-3 text-xs leading-5 text-[var(--tm-text-secondary)]">코트 비용은 앱에서 결제되지 않으며, 참가자끼리 별도로 정산해요.</p>
        </div>
      </article>
    </div>
  );
}

function StepIntro({ description, eyebrow, title }: { description: string; eyebrow: string; title: ReactNode }) {
  return <header><p className="text-sm font-bold text-[var(--tm-action-primary)]">{eyebrow}</p><h1 className="mt-2 text-[28px] font-bold leading-[1.32] tracking-[-0.04em]">{title}</h1><p className="mt-3 max-w-[420px] text-sm leading-6 text-[var(--tm-text-secondary)]">{description}</p></header>;
}

function FormPanel({ children, description, icon, title }: { children: ReactNode; description: string; icon?: ReactNode; title: ReactNode }) {
  return <section className="mt-6 rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(29,50,84,0.06)]"><div className="flex gap-3">{icon ? <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--tm-bg-subtle)] text-[var(--tm-action-primary)]">{icon}</span> : null}<div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm leading-6 text-[var(--tm-text-secondary)]">{description}</p></div></div><div className="mt-5">{children}</div></section>;
}

function FieldTitle({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return <span className="flex items-center gap-2 text-sm font-bold"><span>{children}</span>{required ? <span className="rounded-full bg-[var(--tm-bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--tm-action-primary)]">필수</span> : null}</span>;
}

function ChoiceCard({ children, description, onClick, selected }: { children: ReactNode; description: string; onClick: () => void; selected: boolean }) {
  return <button aria-pressed={selected} className={`relative min-h-[78px] rounded-2xl border p-4 pr-11 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-action-primary)] ${selected ? "border-[var(--tm-action-primary)] bg-[var(--tm-bg-subtle)] text-[var(--tm-action-primary)]" : "border-[var(--tm-border-default)] bg-white text-[var(--tm-text-primary)] hover:border-[var(--tm-action-primary)]"}`} onClick={onClick} type="button"><strong className="text-sm">{children}</strong><span className="mt-1 block text-xs font-normal leading-5 text-[var(--tm-text-secondary)]">{description}</span>{selected ? <CheckCircle aria-label="선택됨" className="absolute right-4 top-4" size={20} weight="fill" /> : null}</button>;
}

function PreviewItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 text-[var(--tm-action-primary)]">{icon}</span><div><dt className="text-xs font-bold text-[var(--tm-text-secondary)]">{label}</dt><dd className="mt-1 text-sm leading-5 text-[var(--tm-text-primary)]">{value}</dd></div></div>;
}

function ActionFooter({ action, disabled, onBack, onNext, saving, uploading }: { action: string; disabled: boolean; onBack?: () => void; onNext: () => void; saving: boolean; uploading: boolean }) {
  const label = saving ? "등록 중…" : uploading ? "사진 올리는 중…" : action;

  return <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--tm-border-subtle)] bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"><div className="mx-auto flex max-w-[560px] gap-3">{onBack ? <button className="min-h-[54px] shrink-0 rounded-2xl bg-[var(--tm-bg-subtle)] px-5 text-sm font-bold text-[var(--tm-text-primary)]" onClick={onBack} type="button">이전</button> : null}<button className="flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--tm-action-primary)] px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(49,94,158,0.22)] transition hover:bg-[var(--tm-action-hover)] disabled:cursor-not-allowed disabled:opacity-45" disabled={disabled} onClick={onNext} type="button">{label}{!saving && !uploading && action !== "매칭 공개하기" ? <ArrowRight aria-hidden size={18} weight="bold" /> : null}</button></div></footer>;
}
