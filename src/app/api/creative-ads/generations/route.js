import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's GET /creative-ads/generations.
export async function GET(request) {
  const { search } = new URL(request.url);
  const { status, data } = await authedBackendGet(`/creative-ads/generations${search}`);
  return NextResponse.json(data, { status });
}
