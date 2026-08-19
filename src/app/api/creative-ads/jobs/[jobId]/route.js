import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's GET /creative-ads/jobs/:jobId.
export async function GET(request, { params }) {
  const { jobId } = await params;
  const { status, data } = await authedBackendGet(`/creative-ads/jobs/${jobId}`);
  return NextResponse.json(data, { status });
}
