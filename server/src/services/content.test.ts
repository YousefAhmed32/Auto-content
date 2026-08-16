import { describe, expect, it } from "vitest";
import type { MediaAsset, PostRecord } from "../types.js";
import { formatCaption, resolveContentForPlatform, resolveMediaForPlatform } from "./content.js";

function makeAsset(id: string, order: number): MediaAsset {
  return { id, originalName: `${id}.jpg`, storedName: `${id}.jpg`, mimeType: "image/jpeg", kind: "image", size: 100, url: `https://example.com/${id}`, order };
}

function makePost(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    id: "post-1",
    contentMode: "advanced",
    base: { title: "عنوان", caption: "نص أساسي", hashtags: ["a", "b"] },
    platforms: ["facebook", "instagram"],
    overrides: {},
    media: [makeAsset("c", 2), makeAsset("a", 0), makeAsset("b", 1)],
    status: "draft",
    publishMode: "now",
    platformResults: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("resolveMediaForPlatform", () => {
  it("falls back to base media order when no override is set", () => {
    const post = makePost();
    const result = resolveMediaForPlatform(post, "facebook");
    expect(result.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("uses a platform-specific subset/order when overrides.mediaOrder is set", () => {
    const post = makePost({ overrides: { instagram: { useCustomContent: false, mediaOrder: ["c", "a"] } } });
    const result = resolveMediaForPlatform(post, "instagram");
    expect(result.map((item) => item.id)).toEqual(["c", "a"]);
  });

  it("silently drops override media ids that no longer exist", () => {
    const post = makePost({ overrides: { instagram: { useCustomContent: false, mediaOrder: ["c", "missing", "a"] } } });
    const result = resolveMediaForPlatform(post, "instagram");
    expect(result.map((item) => item.id)).toEqual(["c", "a"]);
  });
});

describe("resolveContentForPlatform", () => {
  it("returns base content when the platform has no custom override", () => {
    const post = makePost();
    expect(resolveContentForPlatform(post, "facebook")).toEqual({ title: "عنوان", caption: "نص أساسي", hashtags: ["a", "b"] });
  });

  it("returns base content when useCustomContent is false even if override fields exist", () => {
    const post = makePost({ overrides: { facebook: { useCustomContent: false, caption: "متجاهل" } } });
    expect(resolveContentForPlatform(post, "facebook").caption).toBe("نص أساسي");
  });

  it("applies the platform override when useCustomContent is true, falling back per-field to base", () => {
    const post = makePost({ overrides: { instagram: { useCustomContent: true, caption: "نص مخصص لإنستغرام" } } });
    const resolved = resolveContentForPlatform(post, "instagram");
    expect(resolved.caption).toBe("نص مخصص لإنستغرام");
    expect(resolved.title).toBe("عنوان");
    expect(resolved.hashtags).toEqual(["a", "b"]);
  });
});

describe("formatCaption", () => {
  it("joins caption and normalized hashtags with a blank line", () => {
    expect(formatCaption("مرحبًا", ["one", "#two"])).toBe("مرحبًا\n\n#one #two");
  });

  it("omits the hashtag line when there are none", () => {
    expect(formatCaption("مرحبًا", [])).toBe("مرحبًا");
  });
});
