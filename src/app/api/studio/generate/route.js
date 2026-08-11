import { NextResponse } from "next/server";
import { authedBackendPost } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's POST /studio/generate. Unlike
// creative-ads/generate, this is a plain JSON response (202 + jobId), not an
// SSE passthrough - the backend queues the job and returns immediately.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { status, data } = await authedBackendPost("/studio/generate", body);
  return NextResponse.json(data, { status });
}
