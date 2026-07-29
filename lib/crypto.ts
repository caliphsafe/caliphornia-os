import crypto from "node:crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function idempotencyKey(parts: Array<string | number | null | undefined>) {
  return parts.map((part) => String(part ?? "none")).join(":");
}
