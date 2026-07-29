import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";

export async function requireAdminUser() {
  const user = await getCurrentAppUser();
  if (!user?.id || !["admin", "owner"].includes(String(user.role || ""))) {
    throw new Error("ADMIN_REQUIRED");
  }
  return user;
}

export function adminError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message === "ADMIN_REQUIRED" ? 403 : 500;
  return NextResponse.json({ ok: false, error: status === 403 ? "Admin access required." : "Admin action failed." }, { status });
}
