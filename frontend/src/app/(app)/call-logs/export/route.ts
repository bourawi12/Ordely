import { api } from "@/lib/api";
import { parseParams } from "../params";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = parseParams(Object.fromEntries(searchParams));
  const csv = await api.exportCalls({
    status: params.status,
    search: params.search,
    range: params.range,
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ordely-calls-${date}.csv"`,
    },
  });
}
