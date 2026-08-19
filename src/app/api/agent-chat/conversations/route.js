import { NextResponse } from "next/server";
import { authedBackendPost } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's POST /agent-chat/conversations.
export async function POST() {
  const { status, data } = await authedBackendPost("/agent-chat/conversations", {});
  return NextResponse.json(data, { status });
}
