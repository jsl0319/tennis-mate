"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

import { CourtRallyLoader } from "@/components/feedback/court-rally-loader";
import { BackButton } from "@/components/navigation/back-button";

type Conversation = {
  match: { id: string; title: string; startsAt: string; endsAt: string; status: string };
  status: "OPEN" | "READ_ONLY" | "ARCHIVED";
  canSend: boolean;
  sendingSuspended: boolean;
};

type Message = {
  id: string;
  type: "USER" | "SYSTEM";
  body: string;
  isHidden: boolean;
  isMine: boolean;
  sender: { nickname: string } | null;
  createdAt: string;
  pending?: boolean;
};

type MessagesResponse = { items: Message[]; pageInfo: { hasMoreBefore: boolean; nextBefore: string | null; latestCursor: string | null } };

const reportReasons = [
  ["HARASSMENT", "괴롭힘"],
  ["SEXUAL_OR_HATEFUL_CONTENT", "성적·혐오 표현"],
  ["PERSONAL_INFORMATION", "개인정보 노출"],
  ["SPAM_OR_FRAUD", "스팸·사기"],
  ["OTHER", "기타"],
] as const;

function apiMessage(body: unknown, fallback: string) {
  return typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error && typeof body.error.message === "string" ? body.error.message : fallback;
}

function schedule(startsAt: string, endsAt: string) {
  const start = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(startsAt));
  const end = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(endsAt));
  return `${start}–${end}`;
}

function messageTime(createdAt: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" }).format(new Date(createdAt));
}

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || left.id.localeCompare(right.id));
}

export function MatchConversation({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const latestCursor = useRef<string | null>(null);
  const nextBeforeCursor = useRef<string | null>(null);
  const lastMessageId = useRef<string | null>(null);
  const [canLoadOlderMessages, setCanLoadOlderMessages] = useState(false);

  const markRead = useCallback(async (messageId: string) => {
    try {
      await fetch(`/api/v1/matches/${encodeURIComponent(matchId)}/conversation/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }) });
    } catch { /* Read markers are an internal convenience and never block chat. */ }
  }, [matchId]);

  const fetchMessages = useCallback(async (mode: "initial" | "after" | "before") => {
    const cursor = mode === "after" ? latestCursor.current : mode === "before" ? nextBeforeCursor.current : null;
    const suffix = cursor ? `?${mode === "before" ? "before" : "after"}=${encodeURIComponent(cursor)}` : "";
    const response = await fetch(`/api/v1/matches/${encodeURIComponent(matchId)}/conversation/messages${suffix}`, { cache: "no-store" });
    const body: unknown = await response.json();
    if (!response.ok) throw new Error(apiMessage(body, "메시지를 불러오지 못했어요."));
    const data = body as MessagesResponse;
    if (mode === "initial") setMessages(data.items);
    else if (data.items.length > 0) setMessages((current) => mergeMessages(current, data.items));
    if (mode !== "before") latestCursor.current = data.pageInfo.latestCursor ?? latestCursor.current;
    if (mode === "initial" || mode === "before") {
      nextBeforeCursor.current = data.pageInfo.nextBefore;
      setCanLoadOlderMessages(data.pageInfo.hasMoreBefore);
    }
    const messageId = mode === "before" ? null : data.items.at(-1)?.id ?? lastMessageId.current;
    if (messageId && messageId !== lastMessageId.current) {
      lastMessageId.current = messageId;
      void markRead(messageId);
    }
  }, [markRead, matchId]);

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(`/api/v1/matches/${encodeURIComponent(matchId)}/conversation`, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "채팅방을 불러오지 못했어요."));
      setConversation(body as Conversation);
      await fetchMessages("initial");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "채팅방을 불러오지 못했어요.");
    }
  }, [fetchMessages, matchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!conversation) return;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await fetchMessages("after");
        setPollError("");
      } catch (caught) {
        setPollError(caught instanceof Error ? caught.message : "새 메시지를 불러오지 못했어요.");
      }
    };
    const timer = window.setInterval(() => { void poll(); }, 5_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [conversation, fetchMessages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !conversation || !conversation.canSend || sending) return;
    const clientRequestId = crypto.randomUUID();
    const temporary: Message = { id: `pending-${clientRequestId}`, type: "USER", body, isHidden: false, isMine: true, sender: null, createdAt: new Date().toISOString(), pending: true };
    setMessages((current) => [...current, temporary]);
    setDraft("");
    setSending(true);
    try {
      const response = await fetch(`/api/v1/matches/${encodeURIComponent(matchId)}/conversation/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, clientRequestId }) });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(result, "메시지를 보내지 못했어요."));
      setMessages((current) => mergeMessages(current.filter((item) => item.id !== temporary.id), [result as Message]));
      await fetchMessages("after");
    } catch (caught) {
      setMessages((current) => current.filter((item) => item.id !== temporary.id));
      setPollError(caught instanceof Error ? caught.message : "메시지를 보내지 못했어요.");
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  if (!conversation) return <main className="grid min-h-svh place-items-center bg-[var(--tm-bg-page)] px-5 text-center text-[var(--tm-text-primary)]">{error ? <section><p>{error}</p><button className="mt-4 min-h-11 rounded-2xl bg-[var(--tm-action-primary)] px-4 text-sm font-semibold text-white" onClick={() => void load()} type="button">다시 불러오기</button><Link className="ml-3 text-sm font-semibold text-[var(--tm-action-primary)]" href="/chats">채팅 목록</Link></section> : <CourtRallyLoader label="채팅방을 준비하고 있어요." />}</main>;

  return <main className="flex min-h-svh flex-col bg-[var(--tm-bg-page)] text-[var(--tm-text-primary)]"><header className="sticky top-0 z-10 border-b border-[var(--tm-border-default)] bg-white/95 px-5 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur"><div className="mx-auto flex max-w-[560px] items-center gap-2"><BackButton className="grid size-11 place-items-center rounded-full text-xl" fallbackPath="/chats" /><div className="min-w-0"><h1 className="truncate text-base font-bold">{conversation.match.title}</h1><p className="mt-0.5 truncate text-xs text-[var(--tm-text-secondary)]">{schedule(conversation.match.startsAt, conversation.match.endsAt)}</p></div></div></header><section aria-live="polite" className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-5 pb-32 pt-5">{conversation.status === "READ_ONLY" ? <p className="rounded-2xl bg-[var(--tm-bg-subtle-muted)] px-4 py-3 text-center text-sm leading-6 text-[var(--tm-text-secondary)]">이 채팅방은 읽기 전용이에요. 기존 안내만 확인할 수 있어요.</p> : null}{pollError ? <button className="mt-3 rounded-2xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-left text-sm text-[var(--tm-status-error-text)]" onClick={() => void fetchMessages("after")} type="button">{pollError} · 다시 불러오기</button> : null}{canLoadOlderMessages ? <button className="mx-auto mt-4 min-h-10 rounded-full border border-[var(--tm-border-default)] bg-white px-4 text-xs font-semibold text-[var(--tm-action-primary)]" onClick={() => void fetchMessages("before")} type="button">이전 메시지 불러오기</button> : null}{messages.length === 0 ? <div className="grid flex-1 place-items-center py-16 text-center"><div><p aria-hidden="true" className="text-4xl">🎾</p><h2 className="mt-4 text-lg font-bold">첫 안내를 남겨 보세요</h2><p className="mt-2 text-sm leading-6 text-[var(--tm-text-secondary)]">당일 준비물이나 만날 장소를 편하게 조율할 수 있어요.</p></div></div> : <div className="mt-4 space-y-4">{messages.map((message) => <MessageBubble key={message.id} message={message} onReport={() => setReportTarget(message)} />)}</div>}</section>{conversation.canSend ? <footer className="fixed inset-x-0 bottom-0 border-t border-[var(--tm-border-default)] bg-white/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur"><div className="mx-auto flex max-w-[560px] items-end gap-2"><label className="sr-only" htmlFor="match-chat-message">메시지</label><textarea className="min-h-12 max-h-28 flex-1 resize-none rounded-2xl border border-[var(--tm-border-default)] bg-white px-4 py-3 text-sm leading-5 outline-none placeholder:text-[var(--tm-text-placeholder)] focus:border-[var(--tm-action-primary)] focus:ring-2 focus:ring-[var(--tm-action-primary)]" id="match-chat-message" maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="일정과 준비물을 편하게 이야기해요" value={draft} /><button className="min-h-12 rounded-2xl bg-[var(--tm-action-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={!draft.trim() || sending} onClick={() => void send()} type="button">{sending ? "전송 중" : "보내기"}</button></div><p className="mx-auto mt-1 max-w-[560px] text-right text-xs text-[var(--tm-text-secondary)]">{draft.length}/500</p></footer> : null}{reportTarget ? <ReportSheet matchId={matchId} message={reportTarget} onClose={() => setReportTarget(null)} onSubmitted={() => setReportTarget(null)} /> : null}</main>;
}

function MessageBubble({ message, onReport }: { message: Message; onReport: () => void }) {
  if (message.type === "SYSTEM") return <div className="py-1 text-center"><p className="inline-block rounded-full bg-[var(--tm-bg-subtle-muted)] px-3 py-2 text-xs leading-5 text-[var(--tm-text-secondary)]">{message.body}</p></div>;
  return <div className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}><div className="max-w-[82%]"><div className="flex items-end gap-2"><div className={`rounded-3xl px-4 py-3 text-sm leading-6 ${message.isMine ? "order-2 bg-[var(--tm-action-primary)] text-white" : "bg-white text-[var(--tm-text-primary)] shadow-[0_3px_10px_rgba(49,94,158,0.07)]"}`}><p className="whitespace-pre-wrap break-words">{message.body}</p>{message.pending ? <p className="mt-1 text-right text-[10px] text-white/70">보내는 중</p> : null}</div><time className="shrink-0 text-[10px] text-[var(--tm-text-secondary)]">{messageTime(message.createdAt)}</time></div>{!message.isMine && !message.pending ? <button className="mt-1 min-h-8 px-1 text-xs text-[var(--tm-text-secondary)] underline" onClick={onReport} type="button">신고</button> : null}</div></div>;
}

function ReportSheet({ matchId, message, onClose, onSubmitted }: { matchId: string; message: Message; onClose: () => void; onSubmitted: () => void }) {
  const [reason, setReason] = useState<(typeof reportReasons)[number][0]>("HARASSMENT");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const response = await fetch(`/api/v1/matches/${encodeURIComponent(matchId)}/conversation/messages/${encodeURIComponent(message.id)}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, description: description || null }) });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "신고를 접수하지 못했어요."));
      onSubmitted();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "신고를 접수하지 못했어요."); } finally { setSubmitting(false); }
  };
  return <div className="fixed inset-0 z-20 flex items-end bg-black/35 px-5 pb-[max(20px,env(safe-area-inset-bottom))]" role="presentation"><section aria-label="메시지 신고" aria-modal="true" className="mx-auto w-full max-w-[560px] rounded-[28px] bg-[var(--tm-bg-page)] p-5" role="dialog"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--tm-action-primary)]">안전한 채팅</p><h2 className="mt-1 text-xl font-bold">메시지를 신고할까요?</h2></div><button aria-label="신고 창 닫기" className="grid size-10 place-items-center rounded-full text-xl" disabled={submitting} onClick={onClose} type="button">×</button></div><p className="mt-3 line-clamp-2 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-[var(--tm-text-muted)]">{message.body}</p><fieldset className="mt-5"><legend className="text-sm font-semibold">신고 사유</legend><div className="mt-3 grid gap-2">{reportReasons.map(([value, label]) => <label className={`flex min-h-11 items-center rounded-2xl border px-4 text-sm font-semibold ${reason === value ? "border-[var(--tm-action-primary)] bg-[var(--tm-bg-subtle)] text-[var(--tm-action-primary)]" : "border-[var(--tm-border-default)] bg-white"}`} key={value}><input checked={reason === value} className="sr-only" name="report-reason" onChange={() => setReason(value)} type="radio" value={value} />{label}</label>)}</div></fieldset><label className="mt-5 block text-sm font-semibold" htmlFor="chat-report-description">설명 <span className="font-normal text-[var(--tm-text-secondary)]">(선택)</span></label><textarea className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-[var(--tm-border-default)] bg-white p-3 text-sm outline-none focus:border-[var(--tm-action-primary)]" id="chat-report-description" maxLength={200} onChange={(event) => setDescription(event.target.value)} value={description} /><p className="mt-1 text-right text-xs text-[var(--tm-text-secondary)]">{description.length}/200</p>{error ? <p className="mt-3 rounded-2xl bg-[var(--tm-status-error-bg)] px-4 py-3 text-sm text-[var(--tm-status-error-text)]">{error}</p> : null}<div className="mt-5 grid grid-cols-2 gap-3"><button className="min-h-12 rounded-2xl border border-[var(--tm-border-default)] text-sm font-semibold text-[var(--tm-text-muted)]" disabled={submitting} onClick={onClose} type="button">돌아가기</button><button className="min-h-12 rounded-2xl bg-[var(--tm-action-primary)] text-sm font-semibold text-white disabled:opacity-50" disabled={submitting} onClick={() => void submit()} type="button">{submitting ? "접수 중…" : "신고 접수"}</button></div></section></div>;
}
