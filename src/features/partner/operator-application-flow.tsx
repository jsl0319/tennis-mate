"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";

type Screen = "loading" | "intro" | 1 | 2;

type Application = { id: string };
type Draft = {
  businessName: string;
  businessRegistrationNumber: string;
  businessOpenedOn: string;
  representativeName: string;
  venueName: string;
  venueAddress: string;
  operatorPhone: string;
};

const emptyDraft: Draft = {
  businessName: "", businessRegistrationNumber: "", businessOpenedOn: "", representativeName: "",
  venueName: "", venueAddress: "", operatorPhone: "",
};

function getErrorMessage(body: unknown, fallback: string) {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string"
    ? body.error.message
    : fallback;
}

export function OperatorApplicationFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId");
  const [screen, setScreen] = useState<Screen>("loading");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/v1/operator-applications/me", { cache: "no-store", signal: controller.signal });
        if (response.status === 404 || applicationId) {
          setScreen(applicationId ? 1 : "intro");
          return;
        }
        if (!response.ok) throw new Error(getErrorMessage(await response.json(), "운영자 신청 정보를 불러오지 못했어요."));
        const application = await response.json() as Application;
        router.replace(`/partner/application?applicationId=${encodeURIComponent(application.id)}`);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "운영자 등록을 시작하지 못했어요.");
        setScreen("intro");
      }
    })();
    return () => controller.abort();
  }, [applicationId, router]);

  const set = <Key extends keyof Draft>(key: Key, value: Draft[Key]) => setDraft((current) => ({ ...current, [key]: value }));
  const next = () => {
    setError("");
    if (!draft.businessName.trim() || !draft.businessRegistrationNumber.trim() || !draft.businessOpenedOn || !draft.representativeName.trim()) {
      setError("사업자 정보를 모두 입력해 주세요.");
      return;
    }
    setScreen(2);
  };
  const submit = async () => {
    if (!draft.venueName.trim() || !draft.venueAddress.trim() || !draft.operatorPhone.trim()) {
      setError("테니스장과 운영자 연락처를 모두 입력해 주세요.");
      return;
    }
    setSubmitting(true); setError("");
    try {
      const response = await fetch(applicationId ? `/api/v1/operator-applications/${encodeURIComponent(applicationId)}` : "/api/v1/operator-applications", {
        method: applicationId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(getErrorMessage(await response.json(), "등록 요청을 처리하지 못했어요."));
      router.replace("/partner/application");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "등록 요청을 처리하지 못했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (screen === "loading") return <main className="grid min-h-svh place-items-center bg-[var(--tm-bg-page)] px-5"><CourtRallyLoader className="max-w-[390px]" label="운영자 등록을 준비하고 있어요." /></main>;
  if (screen === "intro") return <Intro onStart={() => setScreen(1)} />;
  if (screen === 1) return <BusinessStep draft={draft} error={error} onBack={() => applicationId ? router.replace("/partner/application") : setScreen("intro")} onNext={next} set={set} />;
  return <VenueStep draft={draft} error={error} submitting={submitting} onBack={() => { setError(""); setScreen(1); }} onSubmit={() => void submit()} set={set} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 pb-28 pt-11 text-[var(--tm-text-primary)]"><div className="mx-auto max-w-[390px]">{children}</div></main>;
}

function Intro({ onStart }: { onStart: () => void }) {
  return <Shell><div className="flex items-center justify-between text-sm text-[var(--tm-text-secondary)]"><span>운영자 등록</span><span>시작하기</span></div><div className="mt-[72px]"><p className="text-sm text-[var(--tm-action-primary)]">COURT PARTNER PILOT</p><h1 className="mt-2 text-2xl font-bold leading-[34px]">테니스장 운영자이신가요?</h1><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">사업자와 테니스장 정보를 확인한 뒤,<br />준비한 시간대를 이용자에게 공개할 수 있어요.</p></div><section className="mt-5 rounded-2xl border border-[var(--tm-border-default)] bg-white p-5"><h2 className="text-lg font-medium">등록 전에 이렇게 확인해요</h2><ol className="mt-3 space-y-3">{[["사업자 정보", "등록번호와 개업일을 확인해요."], ["테니스장 정보", "주소와 운영 권한을 함께 살펴봐요."], ["공개 준비", "승인 후 시간대를 공개할 수 있어요."]].map(([title, description], index) => <li className="flex gap-3" key={title}><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--tm-bg-subtle)] text-sm text-[var(--tm-action-primary)]">{index + 1}</span><span className="text-sm leading-5"><strong className="block font-normal">{title}</strong><span className="text-[var(--tm-text-secondary)]">{description}</span></span></li>)}</ol></section><Notice className="mt-4">심사 중에는 코트와 시간대를 초안으로 저장할 수 있어요. 이용자에게는 아직 보이지 않아요.</Notice><button className="fixed inset-x-5 bottom-7 mx-auto flex h-14 w-[calc(100%-40px)] max-w-[350px] items-center justify-center rounded-2xl bg-[var(--tm-action-primary)] text-lg font-medium text-white" onClick={onStart} type="button">운영자 등록 시작하기</button></Shell>;
}

function BusinessStep({ draft, error, onBack, onNext, set }: { draft: Draft; error: string; onBack: () => void; onNext: () => void; set: <Key extends keyof Draft>(key: Key, value: Draft[Key]) => void }) {
  return <Shell><Progress current={1} onBack={onBack} /><p className="mt-8 text-sm text-[var(--tm-action-primary)]">COURT PARTNER PILOT</p><h1 className="mt-2 text-2xl font-bold leading-[34px]">사업자 정보를 알려주세요</h1><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">운영자 등록을 위해 필요한 정보예요.<br />확인에 실패해도 바로 공개되지는 않아요.</p><div className="mt-5 space-y-3"><Field label="사업자명" value={draft.businessName} placeholder="예) 마포 테니스파크" onChange={(value) => set("businessName", value)} /><Field label="사업자등록번호" inputMode="numeric" value={draft.businessRegistrationNumber} placeholder="숫자 10자리" onChange={(value) => set("businessRegistrationNumber", value)} /><Field label="개업일" type="date" value={draft.businessOpenedOn} placeholder="YYYY.MM.DD" onChange={(value) => set("businessOpenedOn", value)} /><Field label="대표자명" value={draft.representativeName} placeholder="사업자등록증 기준 이름" onChange={(value) => set("representativeName", value)} /></div><Notice className="mt-6">사업자등록번호는 확인 목적으로만 사용해요.<br />등록 정보를 다른 이용자에게 공개하지 않아요.</Notice><StepError error={error} /><button className="fixed inset-x-5 bottom-7 mx-auto flex h-14 w-[calc(100%-40px)] max-w-[350px] items-center justify-center rounded-2xl bg-[var(--tm-action-primary)] text-lg font-medium text-white" onClick={onNext} type="button">다음</button></Shell>;
}

function VenueStep({ draft, error, submitting, onBack, onSubmit, set }: { draft: Draft; error: string; submitting: boolean; onBack: () => void; onSubmit: () => void; set: <Key extends keyof Draft>(key: Key, value: Draft[Key]) => void }) {
  return <Shell><Progress current={2} onBack={onBack} /><p className="mt-8 text-sm text-[var(--tm-action-primary)]">COURT PARTNER PILOT</p><h1 className="mt-2 text-2xl font-bold leading-[34px]">테니스장 정보를 알려주세요</h1><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">직접 운영하는 테니스장만 등록할 수 있어요.<br />정보가 맞지 않으면 확인 자료를 요청할 수 있어요.</p><div className="mt-5 space-y-3"><Field label="테니스장 이름" value={draft.venueName} placeholder="예) 마포 테니스파크" onChange={(value) => set("venueName", value)} /><Field label="테니스장 주소" value={draft.venueAddress} placeholder="주소 검색으로 정확히 입력해 주세요" onChange={(value) => set("venueAddress", value)} /><Field label="운영자 연락처" inputMode="tel" value={draft.operatorPhone} placeholder="심사 결과를 받을 휴대폰 번호" onChange={(value) => set("operatorPhone", value)} /><div><p className="text-sm leading-5">운영 권한 확인 자료 <span className="text-[var(--tm-text-secondary)]">(필요 시)</span></p><div className="mt-1 flex h-[58px] items-center rounded-xl border border-[var(--tm-border-default)] bg-white px-3 text-sm text-[var(--tm-text-secondary)]">검토가 필요하면 안전한 제출 방법을 안내해 드려요.</div></div></div><Notice className="mt-6">사업자 정보와 장소 정보가 다를 때만<br />임대차 계약서나 위임장 등을 요청할 수 있어요.</Notice><StepError error={error} /><button className="fixed inset-x-5 bottom-7 mx-auto flex h-14 w-[calc(100%-40px)] max-w-[350px] items-center justify-center rounded-2xl bg-[var(--tm-action-primary)] text-lg font-medium text-white disabled:opacity-50" disabled={submitting} onClick={onSubmit} type="button">{submitting ? "등록 요청 중…" : "등록 요청하기"}</button></Shell>;
}

function Progress({ current, onBack }: { current: 1 | 2; onBack: () => void }) { return <><div className="flex items-center justify-between"><button aria-label="이전 단계로 돌아가기" className="-ml-2 min-h-11 min-w-11 text-2xl font-bold" onClick={onBack} type="button">‹</button><span className="text-sm text-[var(--tm-text-secondary)]">{current} / 2</span></div><div aria-label={`${current} / 2 단계`} className="mt-5 h-1 overflow-hidden rounded-full bg-[var(--tm-bg-subtle)]"><div className="h-full rounded-full bg-[var(--tm-action-primary)]" style={{ width: current === 1 ? "50%" : "100%" }} /></div></> }
function Field({ label, value, placeholder, onChange, type = "text", inputMode }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; type?: "text" | "date"; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) { const id = `operator-${label}`; return <label className="block text-sm leading-5" htmlFor={id}>{label}<input className="mt-1 h-12 w-full rounded-xl border border-[var(--tm-border-default)] bg-white px-3 text-sm outline-none transition focus:border-[var(--tm-action-primary)]" id={id} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} /></label>; }
function Notice({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-xl bg-[var(--tm-bg-subtle)] p-4 text-sm leading-5 text-[var(--tm-text-secondary)] ${className}`}>{children}</div>; }
function StepError({ error }: { error: string }) { return error ? <p className="mt-3 text-sm leading-5 text-[var(--tm-status-error-text)]" role="alert">{error}</p> : null; }
