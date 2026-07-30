import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/users";

const permanentAdminEmails = new Set(["caliph.safe@gmail.com"]);

export async function requireAdminUser() {
  const user = await getCurrentAppUser();
  const email = String(user?.email || "").trim().toLowerCase();
  const role = String(user?.role || "").trim().toLowerCase();

  if (user?.id && (role === "admin" || role === "owner" || permanentAdminEmails.has(email))) {
    return {
      ...user,
      role: role || (permanentAdminEmails.has(email) ? "owner" : user.role),
    };
  }

  throw new Error("ADMIN_REQUIRED");
}

export function adminError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message === "ADMIN_REQUIRED" ? 403 : 500;
  return NextResponse.json(
    {
      ok: false,
      error: status === 403 ? "Admin access required." : "Admin action failed.",
      detail: status === 403 ? undefined : message,
    },
    { status }
  );
}
