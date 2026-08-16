import { describe, expect, it } from "vitest";
import { firstNMediaIds, getUnconnectedSelectedPlatforms, hasAdvancedCustomizations, isMediaConflictIssue, truncateMediaForCapability } from "./platformGuards";
import type { Connection, MediaAsset, MediaKind, PostRecord } from "../types";

function connection(platform: Connection["platform"], connected: boolean): Connection {
  return { platform, connected, configured: true, accountName: connected ? "Test Account" : undefined };
}

function asset(id: string, order: number, kind: MediaKind = "image"): MediaAsset {
  return { id, originalName: `${id}.jpg`, storedName: `${id}.jpg`, mimeType: kind === "video" ? "video/mp4" : "image/jpeg", kind, size: 10, url: `https://x/${id}`, order };
}

function post(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    id: "p1",
    contentMode: "simple",
    base: { title: "", caption: "", hashtags: [] },
    platforms: [],
    overrides: {},
    media: [],
    status: "draft",
    publishMode: "now",
    platformResults: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("getUnconnectedSelectedPlatforms", () => {
  it("returns only selected platforms that are not connected", () => {
    const connections = [connection("facebook", true), connection("instagram", false), connection("tiktok", false)];
    expect(getUnconnectedSelectedPlatforms(["facebook", "instagram", "tiktok"], connections)).toEqual(["instagram", "tiktok"]);
  });

  it("returns an empty array when every selected platform is connected", () => {
    const connections = [connection("facebook", true), connection("instagram", true)];
    expect(getUnconnectedSelectedPlatforms(["facebook", "instagram"], connections)).toEqual([]);
  });

  it("ignores platforms that are not selected even if disconnected", () => {
    const connections = [connection("facebook", true), connection("youtube", false)];
    expect(getUnconnectedSelectedPlatforms(["facebook"], connections)).toEqual([]);
  });
});

describe("hasAdvancedCustomizations", () => {
  it("is false for a post with no overrides", () => {
    expect(hasAdvancedCustomizations(post())).toBe(false);
  });

  it("is false when overrides exist but useCustomContent is off and everything is default", () => {
    expect(hasAdvancedCustomizations(post({ overrides: { facebook: { useCustomContent: false } } }))).toBe(false);
  });

  it("is true when a platform has custom content enabled", () => {
    expect(hasAdvancedCustomizations(post({ overrides: { instagram: { useCustomContent: true, caption: "خاص" } } }))).toBe(true);
  });

  it("is true when TikTok has non-default privacy/comment settings", () => {
    const withPrivacy = post({ overrides: { tiktok: { useCustomContent: false, tiktok: { allowComments: true, allowDuet: true, allowStitch: true, brandedContent: false, brandOrganic: false, privacyLevel: "SELF_ONLY" } } } });
    expect(hasAdvancedCustomizations(withPrivacy)).toBe(true);
  });

  it("is true when a media subset/order override is set", () => {
    expect(hasAdvancedCustomizations(post({ overrides: { facebook: { useCustomContent: false, mediaOrder: ["a", "b"] } } }))).toBe(true);
  });
});

describe("firstNMediaIds", () => {
  it("returns the first N ids sorted by base order", () => {
    const media = [asset("c", 2), asset("a", 0), asset("b", 1)];
    expect(firstNMediaIds(media, 2)).toEqual(["a", "b"]);
  });

  it("clamps to the available media count", () => {
    const media = [asset("a", 0)];
    expect(firstNMediaIds(media, 5)).toEqual(["a"]);
  });

  it("returns an empty array for a non-positive count", () => {
    const media = [asset("a", 0), asset("b", 1)];
    expect(firstNMediaIds(media, 0)).toEqual([]);
  });
});

describe("truncateMediaForCapability", () => {
  it("caps only the offending kind while keeping every item of the other kind untouched", () => {
    const media = [asset("img-1", 0, "image"), asset("vid-1", 1, "video"), asset("img-2", 2, "image"), asset("img-3", 3, "image")];
    // منصة تقبل فيديو واحدًا كحد أقصى - لكن التعارض هنا في الصور: نتوقع إبقاء الفيديو وكل الصور المسموحة فقط.
    expect(truncateMediaForCapability(media, "image", 2)).toEqual(["img-1", "vid-1", "img-2"]);
  });

  it("keeps images untouched when truncating an excess of videos", () => {
    const media = [asset("img-1", 0, "image"), asset("vid-1", 1, "video"), asset("vid-2", 2, "video")];
    expect(truncateMediaForCapability(media, "video", 1)).toEqual(["img-1", "vid-1"]);
  });

  it("preserves original relative order", () => {
    const media = [asset("c", 2), asset("a", 0), asset("b", 1)];
    expect(truncateMediaForCapability(media, "image", 2)).toEqual(["a", "b"]);
  });

  it("keeps everything when the count is already within the limit", () => {
    const media = [asset("a", 0), asset("b", 1)];
    expect(truncateMediaForCapability(media, "image", 5)).toEqual(["a", "b"]);
  });
});

describe("isMediaConflictIssue", () => {
  it("classifies media-compatibility codes as conflicts", () => {
    expect(isMediaConflictIssue("image-unsupported")).toBe(true);
    expect(isMediaConflictIssue("video-unsupported")).toBe(true);
    expect(isMediaConflictIssue("mixed-media-unsupported")).toBe(true);
    expect(isMediaConflictIssue("image-count-max")).toBe(true);
  });

  it("does not classify unrelated validation codes as media conflicts", () => {
    expect(isMediaConflictIssue("caption-length")).toBe(false);
    expect(isMediaConflictIssue("title-required")).toBe(false);
    expect(isMediaConflictIssue("hashtags-recommended")).toBe(false);
  });
});
