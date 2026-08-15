import crypto from "node:crypto";
import { config } from "./config.js";

const key = crypto.createHash("sha256").update(config.appSecret).digest();

export function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((item) => item.toString("base64url")).join(".");
}

export function decrypt(value: string) {
  const [ivValue, tagValue, payloadValue] = value.split(".");
  if (!ivValue || !tagValue || !payloadValue) throw new Error("Invalid encrypted value");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(payloadValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function createOAuthState(platform: string) {
  const payload = Buffer.from(JSON.stringify({ platform, expiresAt: Date.now() + 10 * 60_000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", config.appSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(value: string, platform: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", config.appSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { platform: string; expiresAt: number };
    return parsed.platform === platform && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

