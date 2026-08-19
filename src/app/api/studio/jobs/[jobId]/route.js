import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's GET /studio/jobs/:jobId.
export async function GET(request, { params }) {
  const { jobId } = await params;
  const { status, data } = await authedBackendGet(`/studio/jobs/${jobId}`);
  return NextResponse.json(data, { status });
}
