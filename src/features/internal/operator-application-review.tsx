"use client";

import { useCallback, useEffect, useState } from "react";

import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";

type Decision = "APPROVE_PUBLISH" | "REQUEST_CHANGES" | "REJECT";
type ReasonCode = "MANUAL_VERIFIED" | "INFORMATION_INCOMPLETE" | "BUSINESS_UNVERIFIED" | "VENUE_UNVERIFIED" | "OPERATING_AUTHORITY_UNCONFIRMED" | "DUPLICATE_VENUE";
type ReviewApplication = {
  id: string;
  businessName: string;
  businessVerificationStatus: string;
  venueVerificationStatus: string;
  venue: { name: string; address: string };
  submittedAt: string | null;
  businessRegistrationCertificateAvailable: boolean;
};
type ReviewList = { items: ReviewApplication[] };
type ReviewDraft = { decision: Decision; reasonCode: ReasonCode };

const reasonOptions: Array<{ value: Exclude<ReasonCode, "MANUAL_VERIFIED">; label: string }> = [
  { value: "INFORMATION_INCOMPLETE", label: "입력 정보가 충분하지 않아요" },
  { value: "BUSINESS_UNVERIFIED", label: "사업자 확인이 필요해요" },
  { value: "VENUE_UNVERIFIED", label: "테니스장 정보 확인이 필요해요" },
  { value: "OPERATING_AUTHORITY_UNCONFIRMED", label: "운영 권한 확인이 필요해요" },
  { value: "DUPLICATE_VENUE", label: "같은 장소 운영 여부를 확인해 주세요" },
];

function messageFrom(body: unknown, fallback: string) {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string"
    ? body.error.message
    : fallback;
}

function formatSubmittedAt(value: string | null) {
  return value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)) : "제출 시각 확인 필요";
}

export function InternalOperatorApplicationReview() {
  const [applications, setApplications] = useState<ReviewApplication[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/internal/operator-applications?status=REVIEW_REQUIRED", { cache: "no-store" });
      if (!response.ok) throw new Error(messageFrom(await response.json(), "심사 대기 목록을 불러오지 못했어요."));
      const body = await response.json() as ReviewList;
      setApplications(body.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "심사 대기 목록을 불러오지 못했어요.");
      setApplications([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const setDecision = (applicationId: string, decision: Decision) => {
    setDrafts((current) => ({
      ...current,
      [applicationId]: {
        decision,
        reasonCode: decision === "APPROVE_PUBLISH" ? "MANUAL_VERIFIED" : current[applicationId]?.reasonCode === "MANUAL_VERIFIED" || !current[applicationId] ? "INFORMATION_INCOMPLETE" : current[applicationId].reasonCode,
      },
    }));
  };

  const setReasonCode = (applicationId: string, reasonCode: Exclude<ReasonCode, "MANUAL_VERIFIED">) => {
    setDrafts((current) => ({
      ...current,
      [applicationId]: { decision: current[applicationId]?.decision ?? "REQUEST_CHANGES", reasonCode },
    }));
  };

  const submit = async (applicationId: string) => {
    const draft = drafts[applicationId];
    if (!draft) {
      setError("판정 결과를 먼저 선택해 주세요.");
      return;
    }

    setSubmittingId(applicationId);
    setError("");
    try {
      const response = await fetch(`/api/internal/operator-applications/${encodeURIComponent(applicationId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(messageFrom(await response.json(), "판정을 저장하지 못했어요."));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "판정을 저장하지 못했어요.");
    } finally {
      setSubmittingId(null);
    }
  };

  if (applications === null) return <main className="grid min-h-svh place-items-center bg-[var(--tm-bg-page)] px-5"><CourtRallyLoader className="max-w-[390px]" label="심사 대기 신청을 불러오고 있어요." /></main>;

  return <main className="min-h-svh bg-[var(--tm-bg-page)] px-5 pb-12 pt-11 text-[var(--tm-text-primary)]"><div className="mx-auto max-w-[390px]"><p className="text-sm font-semibold text-[var(--tm-action-primary)]">INTERNAL REVIEW</p><h1 className="mt-2 text-2xl font-bold leading-[34px]">운영자 신청을<br />확인해 주세요</h1><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">확인한 내용만 선택해 판정해요. 사업자 번호와 연락처는 이 화면에 표시되지 않아요.</p>{error ? <p className="mt-4 rounded-xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm leading-5 text-[var(--tm-status-error-text)]" role="alert">{error}</p> : null}{applications.length ? <div className="mt-6 grid gap-4">{applications.map((application) => <ApplicationCard application={application} draft={drafts[application.id]} key={application.id} onDecision={setDecision} onReasonCode={setReasonCode} onSubmit={submit} submitting={submittingId === application.id} />)}</div> : <section className="mt-8 rounded-2xl border border-[var(--tm-border-default)] bg-white p-5"><h2 className="text-lg font-semibold">심사 대기 신청이 없어요</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">새 신청이 들어오면 이 목록에서 안전한 정보만 확인할 수 있어요.</p><button className="mt-5 min-h-11 rounded-xl border border-[var(--tm-border-default)] px-4 text-sm font-semibold text-[var(--tm-action-primary)]" onClick={() => void load()} type="button">다시 불러오기</button></section>}</div></main>;
}

function ApplicationCard({ application, draft, onDecision, onReasonCode, onSubmit, submitting }: { application: ReviewApplication; draft?: ReviewDraft; onDecision: (applicationId: string, decision: Decision) => void; onReasonCode: (applicationId: string, reasonCode: Exclude<ReasonCode, "MANUAL_VERIFIED">) => void; onSubmit: (applicationId: string) => void; submitting: boolean }) {
  const needsReason = draft && draft.decision !== "APPROVE_PUBLISH";

  return <section className="rounded-2xl border border-[var(--tm-border-default)] bg-white p-5"><p className="text-xs font-semibold text-[var(--tm-text-secondary)]">{formatSubmittedAt(application.submittedAt)}</p><h2 className="mt-2 text-lg font-semibold">{application.businessName}</h2><p className="mt-1 text-sm leading-5 text-[var(--tm-text-secondary)]">{application.venue.name}<br />{application.venue.address}</p><dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--tm-bg-subtle)] p-3 text-xs"><div><dt className="text-[var(--tm-text-secondary)]">사업자 확인</dt><dd className="mt-1 font-semibold">{application.businessVerificationStatus}</dd></div><div><dt className="text-[var(--tm-text-secondary)]">장소 확인</dt><dd className="mt-1 font-semibold">{application.venueVerificationStatus}</dd></div></dl>{application.businessRegistrationCertificateAvailable ? <a className="mt-4 flex min-h-11 items-center justify-center rounded-xl border border-[var(--tm-border-default)] px-4 text-sm font-semibold text-[var(--tm-action-primary)]" href={`/api/internal/operator-applications/${encodeURIComponent(application.id)}/business-registration-certificate`} rel="noreferrer" target="_blank">사업자등록증 안전하게 열기</a> : <p className="mt-4 rounded-xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm leading-5 text-[var(--tm-status-error-text)]">사업자등록증을 다시 제출하도록 요청해 주세요.</p>}<fieldset className="mt-5"><legend className="text-sm font-semibold">판정</legend><div className="mt-2 grid gap-2"><DecisionButton active={draft?.decision === "APPROVE_PUBLISH"} label="공개 승인" onClick={() => onDecision(application.id, "APPROVE_PUBLISH")} /><DecisionButton active={draft?.decision === "REQUEST_CHANGES"} label="정보 보완 요청" onClick={() => onDecision(application.id, "REQUEST_CHANGES")} /><DecisionButton active={draft?.decision === "REJECT"} label="등록 반려" onClick={() => onDecision(application.id, "REJECT")} /></div></fieldset>{needsReason ? <label className="mt-4 block text-sm font-semibold">판정 사유<select className="mt-2 h-11 w-full rounded-xl border border-[var(--tm-border-default)] bg-white px-3 text-sm" onChange={(event) => onReasonCode(application.id, event.target.value as Exclude<ReasonCode, "MANUAL_VERIFIED">)} value={draft.reasonCode}>{reasonOptions.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label> : null}<p className="mt-4 text-xs leading-5 text-[var(--tm-text-secondary)]">판정은 심사자와 시각, 선택한 사유 코드만 감사 이력에 남고 수정할 수 없어요.</p><button className="mt-5 min-h-12 w-full rounded-xl bg-[var(--tm-action-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!draft || submitting || (draft.decision === "APPROVE_PUBLISH" && !application.businessRegistrationCertificateAvailable)} onClick={() => void onSubmit(application.id)} type="button">{submitting ? "판정 저장 중…" : "판정 저장하기"}</button></section>;
}

function DecisionButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button aria-pressed={active} className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold ${active ? "border-[var(--tm-action-primary)] bg-[var(--tm-bg-subtle)] text-[var(--tm-action-primary)]" : "border-[var(--tm-border-default)] bg-white"}`} onClick={onClick} type="button">{label}</button>;
}
