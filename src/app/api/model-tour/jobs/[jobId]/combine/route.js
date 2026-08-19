import { NextResponse } from "next/server";
import { authedBackendPost } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's POST /model-tour/jobs/:jobId/combine.
export async function POST(request, { params }) {
  const { jobId } = await params;
  const { status, data } = await authedBackendPost(`/model-tour/jobs/${jobId}/combine`, {});
  return NextResponse.json(data, { status });
}
