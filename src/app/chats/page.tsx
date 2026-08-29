import { MatchChatList } from "@/features/chats/match-chat-list";
import { requireOnboardedPage } from "@/server/auth/require-onboarded-page";

export default async function ChatsPage() {
  await requireOnboardedPage("/chats");
  return <MatchChatList />;
}
