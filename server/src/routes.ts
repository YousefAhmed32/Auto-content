import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { listCapabilities, mediaKindOf } from "./capabilities.js";
import { callbackUrl, config, isPlatformConfigured } from "./config.js";
import { getConnection, getPost, listPosts, removeConnection, removePost, savePost } from "./store.js";
import { completeOAuth, getAuthorizationUrl } from "./services/oauth.js";
import { getTikTokCreatorInfo } from "./services/platforms/index.js";
import { publishPost, publishSinglePlatform } from "./services/publishing.js";
import { hasBlockingErrors, validatePost } from "./services/validate.js";
import {
  platforms,
  type MediaAsset,
  type PlatformOverride,
  type PostRecord,
  type Platform,
  type PublicConnection
} from "./types.js";

await mkdir(config.uploadsDir, { recursive: true });

/** أقصى عدد ملفات لكل منشور - سقف تطبيقي عام يستوعب أكبر قدرة منصة (TikTok حتى 35 صورة). التحقق الدقيق لكل منصة يتم عبر Capability Matrix وقت النشر. */
const MAX_MEDIA_PER_POST = 35;
const EDITABLE_STATUSES: PostRecord["status"][] = ["draft", "scheduled"];

const storage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).slice(0, 12).toLowerCase();
    callback(null, `${Date.now()}-${nanoid(10)}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: MAX_MEDIA_PER_POST },
  fileFilter: (_request, file, callback) => {
    const allowed = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    if (allowed) callback(null, true);
    else callback(validationError("الملفات يجب أن تكون صورًا أو فيديو"));
  }
});

function isPlatform(value: string): value is Platform {
  return platforms.includes(value as Platform);
}

function parsePlatforms(value: unknown): Platform[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = value.split(","); }
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.map(String).filter(isPlatform))];
}

function parseHashtags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map(String).map((item) => item.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 50);
  }
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 50);
}

function validationError(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function parseContentMode(value: unknown, fallback: "simple" | "advanced" = "advanced"): "simple" | "advanced" {
  return value === "simple" || value === "advanced" ? value : fallback;
}

function parseMediaMeta(value: unknown, count: number): Array<{ altText?: string; caption?: string; width?: number; height?: number }> {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { parsed = []; }
  }
  const list = Array.isArray(parsed) ? parsed : [];
  return Array.from({ length: count }, (_, index) => {
    const entry = list[index];
    if (!entry || typeof entry !== "object") return {};
    const record = entry as Record<string, unknown>;
    const width = typeof record.width === "number" && Number.isFinite(record.width) ? Math.round(record.width) : undefined;
    const height = typeof record.height === "number" && Number.isFinite(record.height) ? Math.round(record.height) : undefined;
    return {
      altText: typeof record.altText === "string" ? record.altText.slice(0, 1000) : undefined,
      caption: typeof record.caption === "string" ? record.caption.slice(0, 300) : undefined,
      width: width && width > 0 ? width : undefined,
      height: height && height > 0 ? height : undefined
    };
  });
}

/** يبني overrides نظيفة من مدخلات العميل: يقبل فقط المنصات المختارة والحقول المعروفة (لا يثق بأي بنية حرة). */
function sanitizeOverrides(raw: unknown, selected: Platform[], mediaIds: Set<string>): PostRecord["overrides"] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  }
  if (!parsed || typeof parsed !== "object") return {};
  const source = parsed as Record<string, unknown>;
  const result: PostRecord["overrides"] = {};

  for (const platform of selected) {
    const entry = source[platform];
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    const override: PlatformOverride = { useCustomContent: Boolean(value.useCustomContent) };

    if (typeof value.title === "string") override.title = value.title.slice(0, 200);
    if (typeof value.caption === "string") override.caption = value.caption.slice(0, 5000);
    if (Array.isArray(value.hashtags)) override.hashtags = parseHashtags(value.hashtags);
    if (Array.isArray(value.mediaOrder)) {
      const order = value.mediaOrder.map(String).filter((id) => mediaIds.has(id));
      if (order.length) override.mediaOrder = order;
    }
    if (typeof value.coverMediaId === "string" && mediaIds.has(value.coverMediaId)) {
      override.coverMediaId = value.coverMediaId;
    }

    if (platform === "tiktok" && value.tiktok && typeof value.tiktok === "object") {
      const t = value.tiktok as Record<string, unknown>;
      override.tiktok = {
        privacyLevel: typeof t.privacyLevel === "string" ? t.privacyLevel : undefined,
        allowComments: t.allowComments !== false,
        allowDuet: t.allowDuet !== false,
        allowStitch: t.allowStitch !== false,
        coverTimestampMs: typeof t.coverTimestampMs === "number" ? Math.max(0, Math.trunc(t.coverTimestampMs)) : undefined,
        coverImageIndex: typeof t.coverImageIndex === "number" ? Math.max(0, Math.trunc(t.coverImageIndex)) : undefined,
        brandedContent: Boolean(t.brandedContent),
        brandOrganic: Boolean(t.brandOrganic)
      };
    }
    if (platform === "instagram" && value.instagram && typeof value.instagram === "object") {
      const i = value.instagram as Record<string, unknown>;
      override.instagram = {
        coverThumbOffsetMs: typeof i.coverThumbOffsetMs === "number" ? Math.max(0, Math.trunc(i.coverThumbOffsetMs)) : undefined
      };
    }
    if (platform === "youtube" && value.youtube && typeof value.youtube === "object") {
      const y = value.youtube as Record<string, unknown>;
      const privacy = y.privacy === "public" || y.privacy === "unlisted" ? y.privacy : "private";
      override.youtube = { privacy };
    }

    result[platform] = override;
  }
  return result;
}

function publicPost(post: PostRecord) {
  return { ...post, validation: validatePost(post) };
}

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({ ok: true, service: "YANSY Publish API", time: new Date().toISOString() });
});

apiRouter.get("/capabilities", (_request, response) => {
  response.json({ capabilities: listCapabilities() });
});

apiRouter.get("/tiktok/creator-info", async (_request, response, next) => {
  try {
    response.json(await getTikTokCreatorInfo());
  } catch (error) { next(Object.assign(error instanceof Error ? error : new Error("تعذر قراءة إعدادات TikTok"), { status: 400 })); }
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

apiRouter.get("/posts/:id", async (request, response) => {
  const post = await getPost(String(request.params.id));
  if (!post) return response.status(404).json({ message: "المنشور غير موجود" });
  return response.json({ post: publicPost(post) });
});

apiRouter.get("/posts/:id/validate", async (request, response) => {
  const post = await getPost(String(request.params.id));
  if (!post) return response.status(404).json({ message: "المنشور غير موجود" });
  const validation = validatePost(post);
  return response.json({ validation, ready: !hasBlockingErrors(validation) });
});

/** ينشئ مسودة منشور جديدة فارغة أو أولية - يُستخدم من أول خطوة في معالج الإنشاء. */
apiRouter.post("/posts", async (request, response) => {
  const id = nanoid(12);
  const now = new Date().toISOString();
  const selectedPlatforms = parsePlatforms(request.body.platforms);
  const post: PostRecord = {
    id,
    contentMode: parseContentMode(request.body.contentMode),
    base: {
      title: String(request.body.title ?? "").trim().slice(0, 200),
      caption: String(request.body.caption ?? "").trim().slice(0, 5000),
      hashtags: parseHashtags(request.body.hashtags)
    },
    platforms: selectedPlatforms,
    overrides: {},
    media: [],
    status: "draft",
    publishMode: "now",
    platformResults: Object.fromEntries(selectedPlatforms.map((platform) => [platform, { status: "pending", attempts: 0 }])),
    createdAt: now,
    updatedAt: now
  };
  await savePost(post);
  response.status(201).json({ post: publicPost(post) });
});

/** تحديث محتوى مسودة/منشور مجدول: المحتوى الأساسي، المنصات، التخصيص لكل منصة، وموعد النشر. */
apiRouter.patch("/posts/:id", async (request, response, next) => {
  try {
    const post = await getPost(String(request.params.id));
    if (!post) throw validationError("المنشور غير موجود");
    if (!EDITABLE_STATUSES.includes(post.status)) {
      throw Object.assign(new Error("لا يمكن تعديل منشور بعد بدء عملية نشره - استخدم إعادة المحاولة بدلًا من ذلك"), { status: 409 });
    }

    if (request.body.contentMode !== undefined) post.contentMode = parseContentMode(request.body.contentMode, post.contentMode);
    if (request.body.title !== undefined) post.base.title = String(request.body.title).trim().slice(0, 200);
    if (request.body.caption !== undefined) post.base.caption = String(request.body.caption).trim().slice(0, 5000);
    if (request.body.hashtags !== undefined) post.base.hashtags = parseHashtags(request.body.hashtags);

    if (request.body.platforms !== undefined) {
      const nextPlatforms = parsePlatforms(request.body.platforms);
      post.platforms = nextPlatforms;
      const nextResults: PostRecord["platformResults"] = {};
      for (const platform of nextPlatforms) {
        nextResults[platform] = post.platformResults[platform] ?? { status: "pending", attempts: 0 };
      }
      post.platformResults = nextResults;
    }

    if (request.body.overrides !== undefined) {
      const mediaIds = new Set(post.media.map((item) => item.id));
      post.overrides = sanitizeOverrides(request.body.overrides, post.platforms, mediaIds);
    }

    if (request.body.publishMode === "now" || request.body.publishMode === "scheduled") {
      post.publishMode = request.body.publishMode;
    }
    if (request.body.timezone !== undefined) post.timezone = String(request.body.timezone).slice(0, 60) || undefined;

    if (post.publishMode === "scheduled") {
      const scheduledAt = String(request.body.scheduledAt ?? post.scheduledAt ?? "");
      if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) throw validationError("اختر موعدًا صحيحًا للجدولة");
      if (new Date(scheduledAt).getTime() <= Date.now()) throw validationError("موعد الجدولة يجب أن يكون في المستقبل");
      post.scheduledAt = new Date(scheduledAt).toISOString();
      post.status = "scheduled";
    } else if (post.status === "scheduled") {
      // رجوع من الجدولة إلى مسودة عند تبديل الوضع إلى "الآن" قبل الضغط على نشر فعليًا.
      post.status = "draft";
      post.scheduledAt = undefined;
    }

    post.updatedAt = new Date().toISOString();
    await savePost(post);
    response.json({ post: publicPost(post) });
  } catch (error) { next(error); }
});

apiRouter.delete("/posts/:id", async (request, response) => {
  const removed = await removePost(String(request.params.id));
  if (!removed) return response.status(404).json({ message: "المنشور غير موجود" });
  await Promise.all(removed.media.map((asset) => unlink(path.join(config.uploadsDir, asset.storedName)).catch(() => undefined)));
  return response.status(204).send();
});

/** رفع ملف/ملفات وسائط إضافية إلى مسودة موجودة (يُضافون في نهاية التسلسل). */
apiRouter.post("/posts/:id/media", upload.array("media", MAX_MEDIA_PER_POST), async (request, response, next) => {
  const files = (request.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const post = await getPost(String(request.params.id));
    if (!post) throw validationError("المنشور غير موجود");
    if (!EDITABLE_STATUSES.includes(post.status)) throw Object.assign(new Error("لا يمكن تعديل وسائط منشور بعد بدء نشره"), { status: 409 });
    if (!files.length) throw validationError("اختر صورة أو فيديو واحدًا على الأقل");
    if (post.media.length + files.length > MAX_MEDIA_PER_POST) {
      throw validationError(`لا يمكن تجاوز ${MAX_MEDIA_PER_POST} ملف وسائط في المنشور الواحد`);
    }

    const meta = parseMediaMeta(request.body.mediaMeta, files.length);
    let nextOrder = post.media.length ? Math.max(...post.media.map((item) => item.order)) + 1 : 0;
    const newAssets: MediaAsset[] = files.map((file, index) => ({
      id: nanoid(10),
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      kind: mediaKindOf(file.mimetype),
      size: file.size,
      url: `${config.publicAppUrl}/api/media/${encodeURIComponent(file.filename)}`,
      order: nextOrder++,
      altText: meta[index]?.altText,
      caption: meta[index]?.caption,
      width: meta[index]?.width,
      height: meta[index]?.height
    }));
    post.media.push(...newAssets);
    post.updatedAt = new Date().toISOString();
    await savePost(post);
    response.status(201).json({ post: publicPost(post) });
  } catch (error) {
    await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
    next(error);
  }
});

apiRouter.patch("/posts/:id/media/reorder", async (request, response, next) => {
  try {
    const post = await getPost(String(request.params.id));
    if (!post) throw validationError("المنشور غير موجود");
    if (!EDITABLE_STATUSES.includes(post.status)) throw Object.assign(new Error("لا يمكن تعديل وسائط منشور بعد بدء نشره"), { status: 409 });
    const order: string[] = Array.isArray(request.body.mediaIds) ? request.body.mediaIds.map(String) : [];
    const byId = new Map(post.media.map((item) => [item.id, item]));
    if (order.length !== post.media.length || !order.every((id) => byId.has(id))) {
      throw validationError("ترتيب الوسائط غير صالح");
    }
    order.forEach((id, index) => { byId.get(id)!.order = index; });
    post.updatedAt = new Date().toISOString();
    await savePost(post);
    response.json({ post: publicPost(post) });
  } catch (error) { next(error); }
});

apiRouter.patch("/posts/:id/media/:mediaId", async (request, response, next) => {
  try {
    const post = await getPost(String(request.params.id));
    if (!post) throw validationError("المنشور غير موجود");
    if (!EDITABLE_STATUSES.includes(post.status)) throw Object.assign(new Error("لا يمكن تعديل وسائط منشور بعد بدء نشره"), { status: 409 });
    const asset = post.media.find((item) => item.id === String(request.params.mediaId));
    if (!asset) throw validationError("الملف غير موجود");
    if (request.body.altText !== undefined) asset.altText = String(request.body.altText).slice(0, 1000) || undefined;
    if (request.body.caption !== undefined) asset.caption = String(request.body.caption).slice(0, 300) || undefined;
    post.updatedAt = new Date().toISOString();
    await savePost(post);
    response.json({ post: publicPost(post) });
  } catch (error) { next(error); }
});

apiRouter.delete("/posts/:id/media/:mediaId", async (request, response, next) => {
  try {
    const post = await getPost(String(request.params.id));
    if (!post) throw validationError("المنشور غير موجود");
    if (!EDITABLE_STATUSES.includes(post.status)) throw Object.assign(new Error("لا يمكن تعديل وسائط منشور بعد بدء نشره"), { status: 409 });
    const index = post.media.findIndex((item) => item.id === String(request.params.mediaId));
    if (index === -1) throw validationError("الملف غير موجود");
    const removed = post.media.splice(index, 1)[0]!;
    post.media.forEach((item, position) => { item.order = position; });
    for (const override of Object.values(post.overrides)) {
      if (!override) continue;
      if (override.mediaOrder) override.mediaOrder = override.mediaOrder.filter((id) => id !== removed.id);
      if (override.coverMediaId === removed.id) override.coverMediaId = undefined;
    }
    post.updatedAt = new Date().toISOString();
    await savePost(post);
    await unlink(path.join(config.uploadsDir, removed.storedName)).catch(() => undefined);
    response.json({ post: publicPost(post) });
  } catch (error) { next(error); }
});

/** يبدأ/يعيد محاولة النشر على كل المنصات التي لم تنجح بعد (idempotent - لا يكرر نشر منصة نجحت). */
apiRouter.post("/posts/:id/publish", async (request, response, next) => {
  try {
    const post = await getPost(String(request.params.id));
    if (!post) throw validationError("المنشور غير موجود");
    if (!post.platforms.length) throw validationError("اختر منصة واحدة على الأقل قبل النشر");
    const validation = validatePost(post);
    if (hasBlockingErrors(validation)) {
      const error = validationError("لا يمكن النشر قبل حل التحذيرات المطلوبة");
      (error as { validation?: unknown }).validation = validation;
      throw error;
    }
    response.json({ post: publicPost((await publishPost(post.id))!) });
  } catch (error) { next(error); }
});

/** إعادة محاولة منصة واحدة فقط دون التأثير على نتائج بقية المنصات. */
apiRouter.post("/posts/:id/publish/:platform", async (request, response, next) => {
  try {
    const platform = request.params.platform;
    if (!isPlatform(platform)) throw validationError("منصة غير مدعومة");
    const post = await getPost(String(request.params.id));
    if (!post) throw validationError("المنشور غير موجود");
    const validation = validatePost(post);
    if (validation[platform]?.some((issue) => issue.severity === "error")) {
      const error = validationError("لا يمكن النشر على هذه المنصة قبل حل التحذيرات المطلوبة");
      (error as { validation?: unknown }).validation = validation;
      throw error;
    }
    response.json({ post: publicPost((await publishSinglePlatform(post.id, platform))!) });
  } catch (error) { next(error); }
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
