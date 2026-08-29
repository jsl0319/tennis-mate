import { getRateLimitedCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { matchChatListQuerySchema } from "@/server/domain/match-chat";
import { getMyMatchConversations } from "@/server/domain/match-chat-service";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getRateLimitedCurrentUser();
    const query = matchChatListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json({ items: await getMyMatchConversations(getPrisma(), user.id, query.role) });
  } catch (error) {
    return handleApiError(error);
  }
}
