import { getCurrentUser } from "@/server/auth/current-user";
import { getPrisma } from "@/server/db/prisma";
import { handleApiError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await getCurrentUser();
    const searchParams = new URL(request.url).searchParams;
    const parentCode = searchParams.get("parentCode");
    const query = searchParams.get("query")?.trim();
    const regions = await getPrisma().region.findMany({
      where: {
        active: true,
        ...(query
          ? { type: "DISTRICT", name: { contains: query, mode: "insensitive" } }
          : { parentCode: parentCode ?? null }),
      },
      select: {
        code: true,
        name: true,
        shortName: true,
        parentCode: true,
        type: true,
        parent: { select: { name: true, shortName: true } },
      },
      orderBy: { name: "asc" },
    });

    return Response.json({
      items: regions.map(({ parent, ...region }) => ({
        ...region,
        parentName: parent?.shortName ?? parent?.name ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
