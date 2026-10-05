import { adminApi, EXPORT_DATASETS, type ExportDataset } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["range", "from", "to", "search", "plan", "status", "sort", "dir", "weeks"]);

/** CSV downloads of the back office; the API checks the admin role (403 otherwise). */
export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!EXPORT_DATASETS.includes(dataset as ExportDataset)) {
    return new Response("Not found", { status: 404 });
  }
  const incoming = new URL(request.url).searchParams;
  const forward = new URLSearchParams();
  for (const [k, v] of incoming) if (ALLOWED.has(k) && v) forward.set(k, v);
  try {
    const csv = await adminApi.exportCsv(dataset as ExportDataset, forward.size ? `?${forward}` : "");
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ordely-admin-${dataset}-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return new Response(err.message, { status: err.status });
    throw err;
  }
}
