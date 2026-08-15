import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { callbackUrl, config, isPlatformConfigured } from "./config.js";
import { removeConnection, getConnection, listPosts, removePost, savePost } from "./store.js";
import { completeOAuth, getAuthorizationUrl } from "./services/oauth.js";
import { publishPost } from "./services/publishing.js";
import { platforms, type Platform, type PostRecord, type PublicConnection } from "./types.js";

await mkdir(config.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).slice(0, 12).toLowerCase();
    callback(null, `${Date.now()}-${nanoid(10)}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    const allowed = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    if (allowed) callback(null, true);
    else callback(new Error("الملف يجب أن يكون صورة أو فيديو"));
  }
});

function isPlatform(value: string): value is Platform {
  return platforms.includes(value as Platform);
}

function parsePlatforms(value: unknown) {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = value.split(","); }
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.map(String).filter(isPlatform))] as Platform[];
}

function parseHashtags(value: unknown) {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 30);
}

function validationError(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({ ok: true, service: "YANSY Publish API", time: new Date().toISOString() });
});

apiRouter.get("/dashboard", async (_request, response) => {
  const posts = await listPosts();
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const published = posts.filter((post) => post.status === "published").length;
  const scheduled = posts.filter((post) => post.status === "scheduled").length;
  const failures = posts.reduce((total, post) => total + Object.values(post.platformResults).filter((result) => result?.status === "failed").length, 0);
  const thisMonth = posts.filter((post) => post.createdAt.startsWith(monthKey)).length;
  response.json({ metrics: { total: posts.length, published, scheduled, failures, thisMonth }, recentPosts: posts.slice(0, 5) });
});

apiRouter.get("/posts", async (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit ?? 100), 1), 200);
  response.json({ posts: (await listPosts()).slice(0, limit) });
});

apiRouter.post("/posts", upload.single("media"), async (request, response, next) => {
  try {
    if (!request.file) throw validationError("اختر صورة أو فيديو للنشر");
    const selectedPlatforms = parsePlatforms(request.body.platforms);
    if (!selectedPlatforms.length) throw validationError("اختر منصة واحدة على الأقل");
    const title = String(request.body.title ?? "").trim();
    if (!title) throw validationError("اكتب عنوان المحتوى");
    const publishMode = request.body.publishMode === "scheduled" ? "scheduled" : "now";
    const scheduledAt = publishMode === "scheduled" ? String(request.body.scheduledAt ?? "") : undefined;
    if (publishMode === "scheduled" && (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime()))) {
      throw validationError("اختر موعدًا صحيحًا للجدولة");
    }
    if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) throw validationError("موعد الجدولة يجب أن يكون في المستقبل");

    const id = nanoid(12);
    const now = new Date().toISOString();
    const post: PostRecord = {
      id,
      title: title.slice(0, 140),
      caption: String(request.body.caption ?? "").trim().slice(0, 5000),
      hashtags: parseHashtags(request.body.hashtags),
      platforms: selectedPlatforms,
      media: {
        id: nanoid(10),
        originalName: request.file.originalname,
        storedName: request.file.filename,
        mimeType: request.file.mimetype,
        size: request.file.size,
        url: `${config.publicAppUrl}/api/media/${encodeURIComponent(request.file.filename)}`
      },
      status: publishMode === "scheduled" ? "scheduled" : "publishing",
      publishMode,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      youtubePrivacy: ["private", "unlisted", "public"].includes(request.body.youtubePrivacy)
        ? request.body.youtubePrivacy
        : "private",
      platformResults: Object.fromEntries(selectedPlatforms.map((platform) => [platform, { status: "pending" }])),
      createdAt: now,
      updatedAt: now
    };
    await savePost(post);
    if (publishMode === "now") void publishPost(post.id);
    response.status(201).json({ post });
  } catch (error) {
    if (request.file && !(error as { persisted?: boolean }).persisted) {
      await unlink(request.file.path).catch(() => undefined);
    }
    next(error);
  }
});

apiRouter.post("/posts/:id/publish", async (request, response, next) => {
  try {
    response.json({ post: await publishPost(request.params.id) });
  } catch (error) { next(error); }
});

apiRouter.delete("/posts/:id", async (request, response) => {
  const removed = await removePost(request.params.id);
  if (!removed) return response.status(404).json({ message: "المنشور غير موجود" });
  await unlink(path.join(config.uploadsDir, removed.media.storedName)).catch(() => undefined);
  return response.status(204).send();
});

apiRouter.get("/connections", async (_request, response) => {
  const result = await Promise.all(platforms.map(async (platform): Promise<PublicConnection> => {
    const connection = await getConnection(platform);
    return {
      platform,
      connected: Boolean(connection),
      configured: isPlatformConfigured(platform),
      accountId: connection?.accountId,
      accountName: connection?.accountName,
      expiresAt: connection?.expiresAt,
      connectedAt: connection?.connectedAt
    };
  }));
  response.json({ connections: result });
});

apiRouter.get("/auth/:platform/url", (request, response, next) => {
  try {
    const platform = request.params.platform;
    if (!isPlatform(platform)) throw validationError("منصة غير مدعومة");
    if (!isPlatformConfigured(platform)) {
      throw validationError(`أضف مفاتيح ${platform} أولًا داخل server/.env`);
    }
    response.json({ url: getAuthorizationUrl(platform), callbackUrl: callbackUrl(platform) });
  } catch (error) { next(error); }
});

apiRouter.get("/auth/:platform/callback", async (request, response) => {
  const platform = request.params.platform;
  try {
    if (!isPlatform(platform)) throw new Error("منصة غير مدعومة");
    const code = String(request.query.code ?? "");
    const state = String(request.query.state ?? "");
    if (!code) throw new Error(String(request.query.error_description ?? request.query.error ?? "لم يصل كود الربط"));
    await completeOAuth(platform, code, state);
    response.redirect(`${config.clientOrigin}/?connected=${platform}`);
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "فشل الربط");
    response.redirect(`${config.clientOrigin}/?connectionError=${message}`);
  }
});

apiRouter.delete("/connections/:platform", async (request, response) => {
  const platform = request.params.platform;
  if (!isPlatform(platform)) return response.status(400).json({ message: "منصة غير مدعومة" });
  await removeConnection(platform);
  return response.status(204).send();
});
