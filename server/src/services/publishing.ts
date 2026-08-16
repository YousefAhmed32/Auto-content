import { getPost, savePost } from "../store.js";
import type { Platform, PostRecord } from "../types.js";
import { publishToPlatform } from "./platforms/index.js";

const active = new Set<string>();

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    if (response?.data) return JSON.stringify(response.data).slice(0, 500);
  }
  return error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء النشر";
}

async function attemptPlatform(post: PostRecord, platform: Platform) {
  const previous = post.platformResults[platform];
  const attempts = (previous?.attempts ?? 0) + 1;
  const startedAt = new Date().toISOString();
  post.platformResults[platform] = { ...(previous ?? { status: "pending", attempts: 0 }), status: "publishing", attempts, lastAttemptAt: startedAt };
  await savePost(post);
  try {
    const result = await publishToPlatform(platform, post);
    post.platformResults[platform] = { ...result, attempts, lastAttemptAt: new Date().toISOString() };
  } catch (error) {
    post.platformResults[platform] = { status: "failed", message: errorMessage(error), attempts, lastAttemptAt: new Date().toISOString() };
  }
}

function recomputeStatus(post: PostRecord) {
  const results = post.platforms.map((platform) => post.platformResults[platform]?.status);
  const successful = results.filter((status) => status === "published").length;
  const failed = results.filter((status) => status === "failed").length;
  if (successful === post.platforms.length && post.platforms.length > 0) post.status = "published";
  else if (successful > 0) post.status = "partial";
  else if (failed === post.platforms.length && post.platforms.length > 0) post.status = "failed";
}

/**
 * ينشر منشورًا على المنصات المطلوبة. آمن لإعادة الاستدعاء (idempotent): أي منصة نجحت مسبقًا
 * (status "published") تُستبعد تلقائيًا من محاولة النشر الجديدة فلا يتكرر نشرها.
 */
export async function publishPost(postId: string, targetPlatforms?: Platform[]) {
  if (active.has(postId)) return getPost(postId);
  const post = await getPost(postId);
  if (!post) throw new Error("المنشور غير موجود");
  active.add(postId);
  try {
    const platformsToRun = (targetPlatforms ?? post.platforms).filter(
      (platform) => post.platforms.includes(platform) && post.platformResults[platform]?.status !== "published"
    );
    if (!platformsToRun.length) return post;

    post.status = "publishing";
    post.updatedAt = new Date().toISOString();
    await savePost(post);

    await Promise.all(platformsToRun.map((platform) => attemptPlatform(post, platform)));

    recomputeStatus(post);
    post.updatedAt = new Date().toISOString();
    await savePost(post);
    return post;
  } finally {
    active.delete(postId);
  }
}

/** إعادة محاولة منصة واحدة فقط دون التأثير على نتائج المنصات الأخرى. */
export async function publishSinglePlatform(postId: string, platform: Platform) {
  const post = await getPost(postId);
  if (!post) throw new Error("المنشور غير موجود");
  if (!post.platforms.includes(platform)) throw new Error("هذه المنصة غير مختارة ضمن منصات هذا المنشور");
  return publishPost(postId, [platform]);
}

export function startScheduler(listDuePosts: () => Promise<PostRecord[]>) {
  const run = async () => {
    const duePosts = await listDuePosts();
    await Promise.allSettled(duePosts.map((post) => publishPost(post.id)));
  };
  const interval = setInterval(() => void run(), 15_000);
  interval.unref();
  void run();
  return () => clearInterval(interval);
}
