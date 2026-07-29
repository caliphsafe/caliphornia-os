import { randomToken, sha256 } from "@/lib/crypto";

export function createTokenPair() {
  const token = randomToken(32);
  return { token, tokenHash: sha256(token) };
}

const WORDS = ["GOLDEN", "PALM", "NIGHT", "TRAIN", "BLUE", "RADIO", "SUNSET", "NOTE", "OCEAN", "LIGHT", "VELVET", "DRUM", "SILVER", "CLOUD", "RIVER", "STAR"];

export function createPhrase() {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${pick()} ${pick()} ${pick()}`;
}
