// HMAC + timing-safe compare via Web Crypto pour fonctionner en Edge runtime
// (middleware) ET Node runtime (api routes).

const COOKIE_NAME = "crd_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  const s = process.env.COOKIE_SECRET;
  if (!s || s.length < 16) throw new Error("COOKIE_SECRET must be set (>=16 chars)");
  return s;
}

function toHex(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, "0");
  return out;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(sig);
}

function timingSafeEqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

export async function makeSessionCookie(): Promise<{ name: string; value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `1.${exp}`;
  const sig = await sign(payload);
  return { name: COOKIE_NAME, value: `${payload}.${sig}`, maxAge: MAX_AGE_SECONDS };
}

export async function verifySessionCookie(raw: string | undefined): Promise<boolean> {
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [version, expStr, sig] = parts;
  if (version !== "1") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = await sign(`${version}.${expStr}`);
  return timingSafeEqHex(sig, expected);
}

export function checkCredentials(user: string, pass: string): boolean {
  const u = process.env.DASHBOARD_USER;
  const p = process.env.DASHBOARD_PASS;
  if (!u || !p) return false;
  if (user.length !== u.length || pass.length !== p.length) return false;
  let acc = 0;
  for (let i = 0; i < user.length; i++) acc |= user.charCodeAt(i) ^ u.charCodeAt(i);
  for (let i = 0; i < pass.length; i++) acc |= pass.charCodeAt(i) ^ p.charCodeAt(i);
  return acc === 0;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
