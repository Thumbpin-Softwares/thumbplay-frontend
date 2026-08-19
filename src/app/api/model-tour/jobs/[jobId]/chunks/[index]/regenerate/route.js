import { NextResponse } from "next/server";
import { authedBackendPost } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's POST /model-tour/jobs/:jobId/chunks/:index/regenerate.
export async function POST(request, { params }) {
  const { jobId, index } = await params;
  const body = await request.json().catch(() => ({}));
  const { status, data } = await authedBackendPost(`/model-tour/jobs/${jobId}/chunks/${index}/regenerate`, body);
  return NextResponse.json(data, { status });
}
