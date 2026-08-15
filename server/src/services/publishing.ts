import { getPost, savePost } from "../store.js";
import type { Platform, PostRecord } from "../types.js";
import { publishToPlatform } from "./publishers.js";

const active = new Set<string>();

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    if (response?.data) return JSON.stringify(response.data).slice(0, 500);
  }
  return error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء النشر";
}

export async function publishPost(postId: string) {
  if (active.has(postId)) return getPost(postId);
  const post = await getPost(postId);
  if (!post) throw new Error("المنشور غير موجود");
  active.add(postId);
  try {
    post.status = "publishing";
    post.updatedAt = new Date().toISOString();
    for (const platform of post.platforms) {
      post.platformResults[platform] = { status: "publishing" };
    }
    await savePost(post);

    const results = await Promise.allSettled(
      post.platforms.map(async (platform) => ({ platform, result: await publishToPlatform(platform, post) }))
    );
    results.forEach((settled, index) => {
      const platform = post.platforms[index] as Platform;
      post.platformResults[platform] = settled.status === "fulfilled"
        ? settled.value.result
        : { status: "failed", message: errorMessage(settled.reason) };
    });

    const successful = post.platforms.filter((platform) => post.platformResults[platform]?.status === "published").length;
    post.status = successful === post.platforms.length ? "published" : successful > 0 ? "partial" : "failed";
    post.updatedAt = new Date().toISOString();
    await savePost(post);
    return post;
  } finally {
    active.delete(postId);
  }
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

