import crypto from "crypto";

const SESSION_SECRET = process.env.APP_SESSION_SECRET!;

export type SessionPayload = {
  email: string;
  username?: string;
  iat: number;
};

function toBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function signSession(payload: SessionPayload) {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

export function verifySession(token?: string | null): SessionPayload | null {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  if (signature !== expected) return null;

  try {
    return JSON.parse(fromBase64Url(encoded)) as SessionPayload;
  } catch {
    return null;
  }
}
