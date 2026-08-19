import { NextResponse } from "next/server";
import { authedBackendGet } from "@/lib/backend-session";

// Thin proxy to thumbpin-backend's GET /agent-chat/conversations/:conversationId.
export async function GET(request, { params }) {
  const { conversationId } = await params;
  const { status, data } = await authedBackendGet(`/agent-chat/conversations/${conversationId}`);
  return NextResponse.json(data, { status });
}
