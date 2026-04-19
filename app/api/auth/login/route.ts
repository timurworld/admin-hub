import { NextResponse } from "next/server";
import {
  isValidLogin,
  makeSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!(await isValidLogin(username, password))) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = await makeSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
