import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PostRecord } from "../types.js";

const store = new Map<string, PostRecord>();

vi.mock("../store.js", () => ({
  getPost: vi.fn(async (id: string) => {
    const found = store.get(id);
    return found ? structuredClone(found) : undefined;
  }),
  savePost: vi.fn(async (post: PostRecord) => {
    store.set(post.id, structuredClone(post));
    return post;
  })
}));

const publishToPlatform = vi.fn();
vi.mock("./platforms/index.js", () => ({ publishToPlatform: (...args: unknown[]) => publishToPlatform(...(args as [string, PostRecord])) }));

const { publishPost, publishSinglePlatform } = await import("./publishing.js");

function makePost(): PostRecord {
  return {
    id: "p1",
    contentMode: "advanced",
    base: { title: "عنوان", caption: "نص", hashtags: [] },
    platforms: ["facebook", "tiktok"],
    overrides: {},
    media: [],
    status: "draft",
    publishMode: "now",
    platformResults: { facebook: { status: "pending", attempts: 0 }, tiktok: { status: "pending", attempts: 0 } },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

beforeEach(() => {
  store.clear();
  publishToPlatform.mockReset();
});

describe("publishPost", () => {
  it("reports partial success when one platform succeeds and another fails", async () => {
    const post = makePost();
    store.set(post.id, post);
    publishToPlatform.mockImplementation(async (platform: string) => {
      if (platform === "facebook") return { status: "published", externalId: "123", publishedAt: "now" };
      throw new Error("tiktok is down");
    });

    const result = await publishPost(post.id);

    expect(result!.status).toBe("partial");
    expect(result!.platformResults.facebook?.status).toBe("published");
    expect(result!.platformResults.facebook?.attempts).toBe(1);
    expect(result!.platformResults.tiktok?.status).toBe("failed");
    expect(result!.platformResults.tiktok?.message).toContain("tiktok is down");
  });

  it("does not re-publish an already-published platform on retry (idempotent)", async () => {
    const post = makePost();
    post.platformResults.facebook = { status: "published", attempts: 1, externalId: "abc" };
    post.platformResults.tiktok = { status: "failed", attempts: 1 };
    store.set(post.id, post);
    publishToPlatform.mockResolvedValue({ status: "published", externalId: "second-try" });

    const result = await publishPost(post.id);

    expect(publishToPlatform).toHaveBeenCalledTimes(1);
    expect(publishToPlatform).toHaveBeenCalledWith("tiktok", expect.anything());
    expect(result!.platformResults.facebook?.externalId).toBe("abc");
    expect(result!.platformResults.tiktok?.status).toBe("published");
    expect(result!.status).toBe("published");
  });

  it("is a no-op and never calls the adapter when every platform already published", async () => {
    const post = makePost();
    post.platformResults.facebook = { status: "published", attempts: 1 };
    post.platformResults.tiktok = { status: "published", attempts: 1 };
    store.set(post.id, post);

    await publishPost(post.id);

    expect(publishToPlatform).not.toHaveBeenCalled();
  });

  it("increments the attempt counter across repeated failures", async () => {
    const post = makePost();
    post.platforms = ["facebook"];
    post.platformResults = { facebook: { status: "failed", attempts: 2 } };
    store.set(post.id, post);
    publishToPlatform.mockRejectedValue(new Error("still failing"));

    const result = await publishPost(post.id);

    expect(result!.platformResults.facebook?.attempts).toBe(3);
    expect(result!.status).toBe("failed");
  });
});

describe("publishSinglePlatform", () => {
  it("retries only the requested platform, leaving the others untouched", async () => {
    const post = makePost();
    post.platformResults.facebook = { status: "failed", attempts: 1 };
    post.platformResults.tiktok = { status: "failed", attempts: 1 };
    store.set(post.id, post);
    publishToPlatform.mockResolvedValue({ status: "published", externalId: "ok" });

    const result = await publishSinglePlatform(post.id, "facebook");

    expect(publishToPlatform).toHaveBeenCalledTimes(1);
    expect(publishToPlatform).toHaveBeenCalledWith("facebook", expect.anything());
    expect(result!.platformResults.facebook?.status).toBe("published");
    expect(result!.platformResults.tiktok?.status).toBe("failed");
    expect(result!.status).toBe("partial");
  });

  it("rejects when the platform was never selected for this post", async () => {
    const post = makePost();
    store.set(post.id, post);
    await expect(publishSinglePlatform(post.id, "youtube")).rejects.toThrow();
  });
});
