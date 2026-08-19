import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

// Thin SSE pass-through to thumbpin-backend's POST
// /agent-chat/conversations/:conversationId/messages - mirrors
// app/api/creative-ads/generate/route.js.
export async function POST(request, { params }) {
  const { conversationId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.text();

  let backendRes;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/v1/agent-chat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}`, "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[agent-chat/messages] Failed to reach backend:", error);
    return new Response(JSON.stringify({ error: "Unable to reach the server" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!backendRes.ok || !backendRes.body) {
    const data = await backendRes.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: backendRes.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
