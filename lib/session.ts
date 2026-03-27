import crypto from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev_session_secret_change_me";

export type SessionPayload = {
  email: string;
  username?: string;
  iat: number;
};

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}

function signValue(value: string) {
  return toBase64Url(
    crypto.createHmac("sha256", SESSION_SECRET).update(value).digest()
  );
}

export function signSession(payload: SessionPayload) {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = signValue(body);
  return `${body}.${signature}`;
}

export function verifySession(token?: string | null): SessionPayload | null {
  try {
    if (!token) return null;

    const [body, signature] = token.split(".");
    if (!body || !signature) return null;

    const expected = signValue(body);
    if (signature !== expected) return null;

    const parsed = JSON.parse(fromBase64Url(body));

    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.email !== "string") return null;
    if (typeof parsed.iat !== "number") return null;

    return {
      email: parsed.email,
      username: typeof parsed.username === "string" ? parsed.username : undefined,
      iat: parsed.iat
    };
  } catch {
    return null;
  }
}
