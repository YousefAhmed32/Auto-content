import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, "..");

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: numberFromEnv(process.env.PORT, 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? "http://localhost:4000").replace(/\/$/, ""),
  appSecret: process.env.APP_SECRET ?? "development-only-secret-change-before-deploying",
  contactEmail: process.env.CONTACT_EMAIL ?? "hello@example.com",
  maxUploadBytes: numberFromEnv(process.env.MAX_UPLOAD_MB, 512) * 1024 * 1024,
  dataFile: process.env.DATA_FILE ?? path.join(serverRoot, "data", "store.json"),
  uploadsDir: process.env.UPLOADS_DIR ?? path.join(serverRoot, "uploads"),
  clientDistDir: path.resolve(serverRoot, "../client/dist"),
  meta: {
    appId: process.env.META_APP_ID ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    graphVersion: process.env.META_GRAPH_VERSION ?? "v23.0"
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
  },
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY ?? "",
    clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? ""
  }
};

export function isPlatformConfigured(platform: string) {
  if (platform === "facebook" || platform === "instagram") {
    return Boolean(config.meta.appId && config.meta.appSecret);
  }
  if (platform === "youtube") {
    return Boolean(config.google.clientId && config.google.clientSecret);
  }
  if (platform === "tiktok") {
    return Boolean(config.tiktok.clientKey && config.tiktok.clientSecret);
  }
  return false;
}

export function callbackUrl(platform: string) {
  return `${config.publicAppUrl}/api/auth/${platform}/callback`;
}
