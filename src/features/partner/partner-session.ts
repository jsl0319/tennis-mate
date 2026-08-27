import type { CourtImageView } from "@/features/matches/court-media";

export type PublicCourtSlot = {
  id: string;
  status: "AVAILABLE" | "ALLOCATED" | "ENDED" | "BLOCKED" | "CANCELLED";
  statusLabel: string;
  statusChangedAt: string;
  startsAt: string;
  endsAt: string;
  totalCourtFeeKrw: number;
  maxParticipantCount: number;
  usageNote: string | null;
  court: {
    name: string;
    address: string;
    courtNumber: string;
    region: { code: string; name: string };
    image: CourtImageView;
  };
  session: { matchId: string; status: string; statusLabel: string } | null;
  availableAction: "OPEN_SESSION" | "VIEW_SESSION" | "READ_ONLY";
};

export function formatPartnerSchedule(startsAt: string, endsAt: string) {
  const date = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Seoul",
  });
  return `${dateFormatter.format(date)} · ${timeFormatter.format(date)}–${timeFormatter.format(end)}`;
}

export function formatStatusChangedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function apiMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  }
  return fallback;
}
