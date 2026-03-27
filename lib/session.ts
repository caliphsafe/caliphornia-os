import jwt from "jsonwebtoken";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev_session_secret_change_me";

export type SessionPayload = {
  email: string;
  username?: string;
  iat: number;
};

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, SESSION_SECRET);
}

export function verifySession(token?: string | null): SessionPayload | null {
  try {
    if (!token) return null;

    const decoded = jwt.verify(token, SESSION_SECRET) as jwt.JwtPayload;

    if (!decoded || typeof decoded !== "object") return null;
    if (typeof decoded.email !== "string") return null;
    if (typeof decoded.iat !== "number") return null;

    return {
      email: decoded.email,
      username: typeof decoded.username === "string" ? decoded.username : undefined,
      iat: decoded.iat
    };
  } catch {
    return null;
  }
}
