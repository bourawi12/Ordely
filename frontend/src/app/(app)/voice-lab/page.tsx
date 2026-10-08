import type { Metadata } from "next";
import { api, ApiError, type CallDetail } from "@/lib/api";
import VoiceLabClient from "./VoiceLabClient";

export const metadata: Metadata = {
  title: "Voice Lab & Telemetry Studio — Ordely",
  description: "Internal developer test workbench for Ringio voice agent integration",
};

export const dynamic = "force-dynamic";

export default async function VoiceLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callParam = typeof params.call === "string" ? Number(params.call) : undefined;

  const data = await api.listCalls({
    range: "all",
    pageSize: 50,
  }).catch(() => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    counts: { all: 0, pending: 0, confirmed: 0, failed: 0, no_answer: 0 },
  }));

  const selectedId = callParam ?? data.items[0]?.id;
  let selectedCall: CallDetail | null = null;

  if (selectedId) {
    selectedCall = await api.getCall(selectedId).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null;
      return null;
    });
  }

  return (
    <VoiceLabClient
      initialCalls={data.items}
      initialSelectedCall={selectedCall}
    />
  );
}
