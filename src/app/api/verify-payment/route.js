import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AUTH_COOKIE_NAME = "auth_token";

// Proxy endpoint: forwards client payment verification requests to Express backend
// POST /api/v1/payments/verify with the auth_token cookie.
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.text();

    const backendRes = await fetch(`${BACKEND_URL}/api/v1/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body,
      cache: "no-store",
    });

    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error) {
    console.error("Verify payment proxy error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
