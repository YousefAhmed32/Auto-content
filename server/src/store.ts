import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaKindOf } from "./capabilities.js";
import { config } from "./config.js";
import type { MediaAsset, Platform, PlatformResult, PostRecord, StoreShape, StoredConnection } from "./types.js";

const emptyStore: StoreShape = { posts: [], connections: [] };
let writeQueue: Promise<void> = Promise.resolve();

/**
 * يرقّي سجل منشور بأي شكل قديم (ملف وسائط مفرد، محتوى موحّد بلا overrides) إلى الشكل الحالي
 * بدون فقد أي بيانات. آمن للتشغيل على سجلات جديدة بالفعل (idempotent).
 */
function migratePost(raw: Record<string, unknown>): PostRecord {
  const legacyMedia = raw.media as (MediaAsset & { kind?: string; order?: number }) | MediaAsset[] | undefined;
  const media: MediaAsset[] = Array.isArray(legacyMedia)
    ? legacyMedia.map((item, index) => ({
        ...item,
        kind: (item as MediaAsset).kind ?? mediaKindOf(item.mimeType),
        order: (item as MediaAsset).order ?? index
      }))
    : legacyMedia
      ? [{ ...legacyMedia, kind: legacyMedia.kind ?? mediaKindOf(legacyMedia.mimeType), order: legacyMedia.order ?? 0 }]
      : [];

  const base = (raw.base as PostRecord["base"] | undefined) ?? {
    title: String(raw.title ?? ""),
    caption: String(raw.caption ?? ""),
    hashtags: Array.isArray(raw.hashtags) ? (raw.hashtags as string[]) : []
  };

  const overrides = { ...((raw.overrides as PostRecord["overrides"]) ?? {}) };
  const legacyYoutubePrivacy = raw.youtubePrivacy as "private" | "unlisted" | "public" | undefined;
  if (legacyYoutubePrivacy && !overrides.youtube) {
    overrides.youtube = { useCustomContent: false, youtube: { privacy: legacyYoutubePrivacy } };
  }

  const rawResults = (raw.platformResults as Record<string, Partial<PlatformResult>>) ?? {};
  const platformResults: PostRecord["platformResults"] = {};
  for (const [platform, result] of Object.entries(rawResults)) {
    if (!result) continue;
    platformResults[platform as Platform] = {
      status: result.status ?? "pending",
      externalId: result.externalId,
      url: result.url,
      message: result.message,
      publishedAt: result.publishedAt,
      attempts: result.attempts ?? (result.status && result.status !== "pending" ? 1 : 0),
      lastAttemptAt: result.lastAttemptAt ?? result.publishedAt
    };
  }

  return {
    id: String(raw.id),
    // منشورات ما قبل Simple/Advanced Mode لا تحمل هذا الحقل - نفترض "advanced" لأنها كانت تُحرَّر بكل التفاصيل أصلًا.
    contentMode: raw.contentMode === "simple" ? "simple" : "advanced",
    base,
    platforms: Array.isArray(raw.platforms) ? (raw.platforms as Platform[]) : [],
    overrides,
    media,
    status: (raw.status as PostRecord["status"]) ?? "draft",
    publishMode: (raw.publishMode as PostRecord["publishMode"]) ?? "now",
    scheduledAt: raw.scheduledAt as string | undefined,
    timezone: raw.timezone as string | undefined,
    platformResults,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString())
  };
}

async function ensureStore() {
  await mkdir(path.dirname(config.dataFile), { recursive: true });
  try {
    await readFile(config.dataFile, "utf8");
  } catch {
    await writeFile(config.dataFile, JSON.stringify(emptyStore, null, 2), "utf8");
  }
}

export async function readStore(): Promise<StoreShape> {
  await ensureStore();
  try {
    const value = JSON.parse(await readFile(config.dataFile, "utf8")) as StoreShape;
    return {
      posts: Array.isArray(value.posts) ? value.posts.map((post) => migratePost(post as unknown as Record<string, unknown>)) : [],
      connections: Array.isArray(value.connections) ? value.connections : []
    };
  } catch {
    return structuredClone(emptyStore);
  }
}

async function writeStore(next: StoreShape) {
  const temp = `${config.dataFile}.tmp`;
  await writeFile(temp, JSON.stringify(next, null, 2), "utf8");
  await rename(temp, config.dataFile);
}

export async function updateStore(mutator: (store: StoreShape) => void | Promise<void>) {
  let result: StoreShape | undefined;
  writeQueue = writeQueue.then(async () => {
    const store = await readStore();
    await mutator(store);
    await writeStore(store);
    result = store;
  });
  await writeQueue;
  return result!;
}

export async function listPosts() {
  const store = await readStore();
  return store.posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPost(id: string) {
  return (await readStore()).posts.find((post) => post.id === id);
}

export async function savePost(post: PostRecord) {
  await updateStore((store) => {
    const index = store.posts.findIndex((item) => item.id === post.id);
    if (index === -1) store.posts.push(post);
    else store.posts[index] = post;
  });
  return post;
}

export async function removePost(id: string) {
  let removed: PostRecord | undefined;
  await updateStore((store) => {
    const index = store.posts.findIndex((item) => item.id === id);
    if (index >= 0) removed = store.posts.splice(index, 1)[0];
  });
  return removed;
}

export async function getConnection(platform: Platform) {
  return (await readStore()).connections.find((item) => item.platform === platform && item.connected);
}

export async function saveConnection(connection: StoredConnection) {
  await updateStore((store) => {
    store.connections = store.connections.filter((item) => item.platform !== connection.platform);
    store.connections.push(connection);
  });
  return connection;
}

export async function removeConnection(platform: Platform) {
  await updateStore((store) => {
    store.connections = store.connections.filter((item) => item.platform !== platform);
  });
}
