"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CourtMedia } from "./court-media";

type Region = { code: string; name: string; shortName: string | null };
type CourtSource = "EXTERNAL_RESERVED" | "COURT_TBD";
type CourtImageDraft = { fileName: string; previewUrl: string; uploadId: string };

const purposes = [["CASUAL_HIT", "편하게 공 주고받기"], ["RALLY_PRACTICE", "랠리"], ["STROKE_PRACTICE", "스트로크 연습"], ["GAME_INTRO", "게임 입문"], ["GAME", "게임"]] as const;
const preferences = [["COMPLETE_BEGINNER_WELCOME", "완전 초보도 좋아요"], ["SIMILAR_LEVEL", "비슷한 수준이면 좋아요"], ["GAME_CAPABLE", "게임 가능한 분을 찾고 있어요"]] as const;

function apiMessage(body: unknown) {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string") return body.error.message;
  return "등록하지 못했어요. 잠시 후 다시 시도해 주세요.";
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
  const [form, setForm] = useState(() => ({ clientRequestId: crypto.randomUUID(), courtSource: "COURT_TBD" as CourtSource, date: "", time: "", duration: 120, cityCode: "", regionCode: "", courtName: "", address: "", courtNumber: "", title: "", recruitCount: 1, playPurposes: ["RALLY_PRACTICE"], partnerPreference: "COMPLETE_BEGINNER_WELCOME", totalCourtFeeKrw: "", additionalCostNote: "", introduction: "", contactOpenChatUrl: "" }));

  useEffect(() => {
    void fetch("/api/v1/regions").then((response) => response.json()).then((body: { items: Region[] }) => setCities(body.items));
  }, []);

  useEffect(() => () => {
    if (courtImage) URL.revokeObjectURL(courtImage.previewUrl);
  }, [courtImage]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const chooseCourtSource = (courtSource: CourtSource) => setForm((current) => ({ ...current, courtSource, ...(courtSource === "COURT_TBD" ? { courtName: "", address: "", courtNumber: "", totalCourtFeeKrw: "", additionalCostNote: "" } : {}) }));
  const selectCity = async (code: string) => {
    set("cityCode", code);
    set("regionCode", "");
    const response = await fetch(`/api/v1/regions?parentCode=${encodeURIComponent(code)}`);
    const body = await response.json() as { items: Region[] };
    setDistricts(body.items);
  };
  const togglePurpose = (purpose: string) => setForm((current) => current.playPurposes.includes(purpose) ? { ...current, playPurposes: current.playPurposes.filter((item) => item !== purpose) } : current.playPurposes.length < 2 ? { ...current, playPurposes: [...current.playPurposes, purpose] } : current);
  const fee = form.totalCourtFeeKrw === "" ? 0 : Math.ceil(Number(form.totalCourtFeeKrw) / (form.recruitCount + 1));

  const uploadCourtImage = async (file: File | null) => {
    if (!file) return;
    setCourtImageError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setCourtImageError("코트 사진은 JPEG, PNG, WebP만 올릴 수 있어요.");
    if (file.size < 1 || file.size > 4 * 1024 * 1024) return setCourtImageError("코트 사진은 4 MiB 이하로 올려 주세요.");

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
      setCourtImage({ fileName: file.name, previewUrl, uploadId });
    } catch (caught) {
      URL.revokeObjectURL(previewUrl);
      setCourtImageError(caught instanceof Error ? caught.message : "코트 사진을 올리지 못했어요.");
    } finally {
      setCourtImageUploading(false);
    }
  };

  const next = () => {
    setError("");
    if (step === 1 && (!form.date || !form.time || !form.regionCode)) return setError("날짜, 시작 시간, 활동 지역을 모두 선택해 주세요.");
    if (step === 1 && form.courtSource === "EXTERNAL_RESERVED" && (!form.courtName.trim() || !form.address.trim())) return setError("예약한 코트의 이름과 주소를 입력해 주세요.");
    if (step === 1 && courtImageUploading) return setError("코트 사진을 올리는 중이에요. 잠시만 기다려 주세요.");
    if (step === 2 && (!form.title.trim() || form.playPurposes.length === 0 || form.recruitCount < 1)) return setError("매칭 제목, 모집 인원, 원하는 플레이를 확인해 주세요.");
    if (step === 3 && form.courtSource === "EXTERNAL_RESERVED" && (form.totalCourtFeeKrw === "" || Number(form.totalCourtFeeKrw) < 0)) return setError("전체 코트 비용을 0원 이상으로 입력해 주세요.");
    if (step === 3 && !form.contactOpenChatUrl.trim()) return setError("코트와 비용을 조율할 카카오 오픈채팅 링크를 입력해 주세요.");
    setStep((current) => current + 1);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const startsAt = new Date(`${form.date}T${form.time}`).toISOString();
      const endsAt = new Date(new Date(startsAt).getTime() + form.duration * 60_000).toISOString();
      const response = await fetch("/api/v1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: form.clientRequestId, title: form.title, startsAt, endsAt, regionCode: form.regionCode, courtSource: form.courtSource,
          externalCourt: form.courtSource === "EXTERNAL_RESERVED" ? { name: form.courtName, address: form.address, courtNumber: form.courtNumber || null, imageUploadId: courtImage?.uploadId ?? null } : null,
          recruitCount: form.recruitCount, playPurposes: form.playPurposes, partnerPreference: form.partnerPreference,
          totalCourtFeeKrw: form.courtSource === "EXTERNAL_RESERVED" ? Number(form.totalCourtFeeKrw) : null,
          additionalCostNote: form.courtSource === "EXTERNAL_RESERVED" ? form.additionalCostNote || null : null,
          introduction: form.introduction || null, contactOpenChatUrl: form.contactOpenChatUrl,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      router.push(`/matches/${(body as { id: string }).id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "등록하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 pb-28 pt-6 text-[var(--tm-text-primary)]"><section className="mx-auto max-w-[560px]"><header className="sticky top-0 z-10 -mx-5 border-b border-[var(--tm-border-subtle)] bg-[var(--tm-bg-page)]/95 px-5 pb-4 pt-1 backdrop-blur"><div className="flex items-center gap-3"><button aria-label={step === 1 ? "이전 화면으로 돌아가기" : "이전 단계"} className="grid size-11 place-items-center rounded-full text-xl" onClick={() => step === 1 ? router.replace("/") : setStep((current) => current - 1)} type="button">←</button><div className="flex-1"><div className="h-1 rounded-full bg-[var(--tm-border-default)]"><div className="h-full rounded-full bg-[var(--tm-action-primary)] transition-all" style={{ width: `${step * 25}%` }} /></div><p className="mt-1 text-right text-xs text-[var(--tm-text-secondary)]">{step}/4</p></div></div></header>

    {step === 1 ? <StepOne cities={cities} courtImage={courtImage} courtImageError={courtImageError} courtImageUploading={courtImageUploading} districts={districts} form={form} onCourtImageChange={(file) => void uploadCourtImage(file)} onCourtSource={chooseCourtSource} onSelectCity={(code) => void selectCity(code)} set={(key, value) => set(key, value as never)} /> : null}
    {step === 2 ? <StepTwo form={form} set={set} onTogglePurpose={togglePurpose} /> : null}
    {step === 3 ? <StepThree fee={fee} form={form} set={set} /> : null}
    {step === 4 ? <StepFour fee={fee} form={form} /> : null}

    {error ? <p className="mt-5 rounded-2xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm leading-6 text-[var(--tm-status-error-text)]">{error}</p> : null}
    <button className="mt-8 min-h-[52px] w-full rounded-2xl bg-[var(--tm-action-primary)] font-semibold text-white shadow-[0_8px_20px_rgba(49,94,158,0.18)] disabled:opacity-40" disabled={saving || courtImageUploading} onClick={() => step < 4 ? next() : void submit()} type="button">{saving ? "등록 중…" : courtImageUploading ? "사진 올리는 중…" : step < 4 ? "다음" : "매칭 공개하기"}</button>
  </section></main>;
}

function StepOne({ cities, courtImage, courtImageError, courtImageUploading, districts, form, onCourtImageChange, onCourtSource, onSelectCity, set }: { cities: Region[]; courtImage: CourtImageDraft | null; courtImageError: string; courtImageUploading: boolean; districts: Region[]; form: { courtSource: CourtSource; date: string; time: string; duration: number; cityCode: string; regionCode: string; courtName: string; address: string; courtNumber: string }; onCourtImageChange: (file: File | null) => void; onCourtSource: (source: CourtSource) => void; onSelectCity: (code: string) => void; set: (key: "date" | "time" | "duration" | "cityCode" | "regionCode" | "courtName" | "address" | "courtNumber", value: string | number) => void }) {
  const selected = (source: CourtSource) => form.courtSource === source;
  return <div className="mt-8"><p className="text-sm font-semibold text-[var(--tm-action-primary)]">매칭 만들기</p><h1 className="mt-1 text-2xl font-bold">언제, 어디서 칠까요?</h1><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">코트는 나중에 함께 정해도 괜찮아요.</p><h2 className="mt-7 text-lg font-bold">코트 예약 상태</h2><div className="mt-3 grid grid-cols-2 gap-2"><Choice selected={selected("COURT_TBD")} onClick={() => onCourtSource("COURT_TBD")} title="코트는 같이 정해요" description="예약 전에도 만들 수 있어요" /><Choice selected={selected("EXTERNAL_RESERVED")} onClick={() => onCourtSource("EXTERNAL_RESERVED")} title="코트를 예약했어요" description="코트 정보와 비용을 입력해요" /></div><Fields><label>날짜<input min={new Date().toISOString().slice(0, 10)} onChange={(event) => set("date", event.target.value)} type="date" value={form.date} /></label><label>시작 시간<input onChange={(event) => set("time", event.target.value)} type="time" value={form.time} /></label><label>이용 시간<select onChange={(event) => set("duration", Number(event.target.value))} value={form.duration}><option value={60}>1시간</option><option value={90}>1시간 30분</option><option value={120}>2시간</option></select></label><label>시<select onChange={(event) => onSelectCity(event.target.value)} value={form.cityCode}><option value="">선택</option>{cities.map((city) => <option key={city.code} value={city.code}>{city.shortName ?? city.name}</option>)}</select></label><label>구<select onChange={(event) => set("regionCode", event.target.value)} value={form.regionCode}><option value="">선택</option>{districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}</select></label></Fields>{form.courtSource === "COURT_TBD" ? <Notice /> : <><Fields><label>코트장 이름<input onChange={(event) => set("courtName", event.target.value)} value={form.courtName} /></label><label>주소<input onChange={(event) => set("address", event.target.value)} value={form.address} /></label><label>코트 번호 <span className="font-normal text-[var(--tm-text-secondary)]">(선택)</span><input onChange={(event) => set("courtNumber", event.target.value)} value={form.courtNumber} /></label></Fields><CourtImageUpload courtImage={courtImage} error={courtImageError} isUploading={courtImageUploading} onChange={onCourtImageChange} /></>}</div>;
}

function CourtImageUpload({ courtImage, error, isUploading, onChange }: { courtImage: CourtImageDraft | null; error: string; isUploading: boolean; onChange: (file: File | null) => void }) {
  const previewLabel = isUploading ? "사진 올리는 중…" : "선택한 코트 사진";
  return <section className="mt-6"><div className="flex items-baseline justify-between gap-3"><h2 className="text-lg font-bold">코트 사진 <span className="text-sm font-normal text-[var(--tm-text-secondary)]">(선택)</span></h2><p className="text-xs text-[var(--tm-text-secondary)]">매칭 화면에서만 보여요</p></div><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">사진이 있으면 함께 칠 분이 코트를 더 쉽게 알아볼 수 있어요.</p>{courtImage ? <CourtMedia alt="선택한 코트 사진 미리보기" className="mt-4 aspect-[350/212] w-full" fallbackLabel="코트 사진을 선택해 보세요" image={null} previewLabel={previewLabel} previewUrl={courtImage.previewUrl} /> : <CourtMedia alt="코트 사진을 선택할 수 있는 영역" className="mt-4 aspect-[350/212] w-full" fallbackLabel="코트 사진을 선택해 보세요" image={null} />}<label className={`mt-4 flex min-h-[52px] cursor-pointer items-center justify-center rounded-2xl border border-[var(--tm-border-default)] bg-white text-lg font-medium text-[var(--tm-text-primary)] ${isUploading ? "cursor-wait opacity-60" : ""}`}><span>{isUploading ? "사진 올리는 중…" : courtImage ? "사진 바꾸기" : "사진 선택하기"}</span><input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isUploading} onChange={(event) => { const file = event.currentTarget.files?.[0] ?? null; event.currentTarget.value = ""; onChange(file); }} type="file" /></label><p className="mt-3 text-sm leading-6 text-[var(--tm-text-secondary)]">JPEG · PNG · WebP · 최대 4MB<br />사진에 얼굴, 연락처, 예약번호가 보이지 않는지 확인해 주세요.</p>{courtImage ? <p className="mt-2 truncate text-xs text-[var(--tm-text-secondary)]">선택한 파일: {courtImage.fileName}</p> : null}{error ? <p className="mt-3 rounded-2xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm leading-6 text-[var(--tm-status-error-text)]">{error}</p> : null}</section>;
}

function StepTwo({ form, set, onTogglePurpose }: { form: { title: string; recruitCount: number; playPurposes: string[]; partnerPreference: string }; set: (key: "title" | "recruitCount" | "partnerPreference", value: string | number) => void; onTogglePurpose: (value: string) => void }) {
  return <div className="mt-8"><p className="text-sm font-semibold text-[var(--tm-action-primary)]">모집 정보</p><h1 className="mt-1 text-2xl font-bold">어떤 테니스를 함께할까요?</h1><Fields><label>매칭 제목<input maxLength={80} onChange={(event) => set("title", event.target.value)} placeholder="예: 주말에 편하게 공 주고받아요" value={form.title} /></label><label>추가 모집 인원<input min="1" onChange={(event) => set("recruitCount", Number(event.target.value))} type="number" value={form.recruitCount} /></label></Fields><p className="mt-6 text-sm font-semibold">원하는 플레이 <span className="font-normal text-[var(--tm-text-secondary)]">(최대 2개)</span></p><div className="mt-3 grid gap-2">{purposes.map(([code, label]) => <SelectCard key={code} selected={form.playPurposes.includes(code)} onClick={() => onTogglePurpose(code)}>{label}</SelectCard>)}</div><p className="mt-6 text-sm font-semibold">원하는 상대</p><div className="mt-3 grid gap-2">{preferences.map(([value, label]) => <SelectCard key={value} selected={form.partnerPreference === value} onClick={() => set("partnerPreference", value)}>{label}</SelectCard>)}</div></div>;
}

function StepThree({ fee, form, set }: { fee: number; form: { courtSource: CourtSource; recruitCount: number; totalCourtFeeKrw: string; additionalCostNote: string; introduction: string; contactOpenChatUrl: string }; set: (key: "totalCourtFeeKrw" | "additionalCostNote" | "introduction" | "contactOpenChatUrl", value: string) => void }) {
  return <div className="mt-8"><p className="text-sm font-semibold text-[var(--tm-action-primary)]">마지막 확인</p><h1 className="mt-1 text-2xl font-bold">비용과 연락 방법을 알려주세요</h1>{form.courtSource === "EXTERNAL_RESERVED" ? <Fields><label>전체 코트 비용<input min="0" onChange={(event) => set("totalCourtFeeKrw", event.target.value)} type="number" value={form.totalCourtFeeKrw} /></label><div className="rounded-2xl bg-[var(--tm-bg-subtle)] p-4 text-sm leading-6">예상 1인 비용 <strong>약 {fee.toLocaleString("ko-KR")}원</strong><br /><span className="text-[var(--tm-text-secondary)]">Tennis Mate에서는 이 비용을 결제하지 않아요.</span></div><label>추가 비용 안내 <span className="font-normal text-[var(--tm-text-secondary)]">(선택)</span><input onChange={(event) => set("additionalCostNote", event.target.value)} value={form.additionalCostNote} /></label></Fields> : <Notice />}<Fields><label>소개 <span className="font-normal text-[var(--tm-text-secondary)]">(선택)</span><textarea maxLength={300} onChange={(event) => set("introduction", event.target.value)} value={form.introduction} /></label><label>카카오 오픈채팅 링크<input onChange={(event) => set("contactOpenChatUrl", event.target.value)} placeholder="https://open.kakao.com/..." value={form.contactOpenChatUrl} /></label><p className="text-sm leading-6 text-[var(--tm-text-secondary)]">수락된 참가자에게만 공개돼요. 코트 미정 매칭에서는 코트와 비용을 조율하는 곳이에요.</p></Fields></div>;
}

function StepFour({ fee, form }: { fee: number; form: { courtSource: CourtSource; date: string; time: string; title: string; recruitCount: number; courtName: string } }) {
  return <div className="mt-8"><p className="text-sm font-semibold text-[var(--tm-action-primary)]">공개 전 확인</p><h1 className="mt-1 text-2xl font-bold">이렇게 모집할까요?</h1><article className="mt-6 rounded-3xl border border-[var(--tm-border-default)] bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-[var(--tm-action-primary)]">{form.courtSource === "COURT_TBD" ? "코트와 비용을 함께 정해요" : "모집자가 코트를 예약했어요"}</p><h2 className="mt-3 text-xl font-bold">{form.title}</h2><p className="mt-4 text-sm leading-6 text-[var(--tm-text-muted)]">🗓 {form.date} · {form.time}<br />📍 {form.courtSource === "COURT_TBD" ? "코트는 함께 정해요" : form.courtName}<br />👥 추가 {form.recruitCount}명 · {form.courtSource === "COURT_TBD" ? "비용 협의 필요" : `1인 약 ${fee.toLocaleString("ko-KR")}원`}</p><p className="mt-4 border-t border-[var(--tm-border-subtle)] pt-3 text-xs leading-5 text-[var(--tm-text-secondary)]">{form.courtSource === "COURT_TBD" ? "수락된 참가자와 오픈채팅에서 코트와 비용을 정해요." : "코트 비용은 참가자끼리 별도로 정산해요."}</p></article></div>;
}

function Choice({ description, onClick, selected, title }: { description: string; onClick: () => void; selected: boolean; title: string }) { return <button aria-pressed={selected} className={`min-h-24 rounded-2xl border p-4 text-left text-sm transition ${selected ? "border-[var(--tm-action-primary)] bg-[var(--tm-action-primary)] text-white" : "border-[var(--tm-border-default)] bg-white text-[var(--tm-text-primary)]"}`} onClick={onClick} type="button"><span className="block font-semibold">{title}</span><span className={`mt-2 block leading-5 ${selected ? "text-white/85" : "text-[var(--tm-text-secondary)]"}`}>{description}</span></button>; }
function SelectCard({ children, onClick, selected }: { children: React.ReactNode; onClick: () => void; selected: boolean }) { return <button aria-pressed={selected} className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${selected ? "border-[var(--tm-action-primary)] bg-[var(--tm-bg-subtle)] text-[var(--tm-action-primary)]" : "border-[var(--tm-border-default)] bg-white"}`} onClick={onClick} type="button">{children}</button>; }
function Notice() { return <section className="mt-5 rounded-2xl bg-[var(--tm-bg-subtle)] p-4"><h2 className="font-semibold text-[var(--tm-action-primary)]">코트와 비용은 함께 정해요</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">일정과 활동 지역만 먼저 정해 보세요. 수락된 참가자에게만 오픈채팅을 보여드려요.</p></section>; }
function Fields({ children }: { children: React.ReactNode }) { return <div className="mt-5 grid gap-4 [&_input]:mt-2 [&_input]:h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[var(--tm-border-default)] [&_input]:bg-white [&_input]:px-3 [&_select]:mt-2 [&_select]:h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-[var(--tm-border-default)] [&_select]:bg-white [&_select]:px-3 [&_textarea]:mt-2 [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[var(--tm-border-default)] [&_textarea]:bg-white [&_textarea]:p-3 [&_label]:text-sm [&_label]:font-semibold">{children}</div>; }
