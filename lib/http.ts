import { NextResponse } from "next/server";

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

export function badRequest(message = "Invalid request") {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export function unauthorized(message = "Please sign in first.") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export function forbidden(message = "Not allowed.") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

export function serverError(message = "Something went wrong.") {
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}
