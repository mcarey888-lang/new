/**
 * Opaque, expiring admin session tokens.
 *
 * Tokens are HMAC-SHA256 signed against ADMIN_API_KEY and expire after 24 hours.
 * The raw ADMIN_API_KEY is never transmitted — only the signed token is sent to
 * the client after a successful password verification.
 *
 * Token format (opaque string, base64url-encoded):
 *   base64url( `${expiryUnixSeconds}:${hmacHex}` )
 *   where hmacHex = HMAC-SHA256( ADMIN_API_KEY, `admin-session:${expiryUnixSeconds}` )
 */

import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Build a signed, time-limited opaque session token from the admin API key.
 * @param apiKey   The server-side ADMIN_API_KEY secret.
 * @param nowSeconds  Current Unix time in seconds (injectable for tests).
 */
export function buildAdminSessionToken(apiKey: string, nowSeconds?: number): string {
  const expiry = (nowSeconds ?? Math.floor(Date.now() / 1000)) + SESSION_TTL_SECONDS;
  const payload = `admin-session:${expiry}`;
  const mac = createHmac("sha256", apiKey).update(payload).digest("hex");
  return Buffer.from(`${expiry}:${mac}`).toString("base64url");
}

/**
 * Verify an opaque session token against the admin API key.
 * Returns true only when the token is well-formed, unexpired, and has a valid MAC.
 * @param token      The opaque token from the Authorization header.
 * @param apiKey     The server-side ADMIN_API_KEY secret.
 * @param nowSeconds Current Unix time in seconds (injectable for tests).
 */
export function verifyAdminSessionToken(token: string, apiKey: string, nowSeconds?: number): boolean {
  let raw: string;
  try {
    raw = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const colonIdx = raw.indexOf(":");
  if (colonIdx === -1) return false;

  const expiryStr = raw.slice(0, colonIdx);
  const mac       = raw.slice(colonIdx + 1);
  const expiry    = Number(expiryStr);
  if (!Number.isFinite(expiry)) return false;

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (now > expiry) return false; // token expired

  const expectedMac = createHmac("sha256", apiKey).update(`admin-session:${expiry}`).digest("hex");

  // Timing-safe comparison to resist side-channel attacks
  try {
    const a = Buffer.from(mac,         "hex");
    const b = Buffer.from(expectedMac, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
