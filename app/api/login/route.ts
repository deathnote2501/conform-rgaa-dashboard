import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, makeSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { user?: string; pass?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }
  if (!body.user || !body.pass || !checkCredentials(body.user, body.pass)) {
    await new Promise((r) => setTimeout(r, 400));
    return new NextResponse("unauthorized", { status: 401 });
  }
  const cookie = await makeSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: cookie.maxAge,
    path: "/",
  });
  return res;
}
