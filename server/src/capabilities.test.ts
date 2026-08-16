import { describe, expect, it } from "vitest";
import { getCapabilities, mediaKindOf, validatePlatformContent } from "./capabilities.js";

function image(overrides: Partial<{ id: string; mimeType: string; size: number; altText: string }> = {}) {
  return { id: overrides.id ?? "img", mimeType: overrides.mimeType ?? "image/jpeg", kind: "image" as const, size: overrides.size ?? 1024, altText: overrides.altText };
}
function video(overrides: Partial<{ id: string; mimeType: string; size: number }> = {}) {
  return { id: overrides.id ?? "vid", mimeType: overrides.mimeType ?? "video/mp4", kind: "video" as const, size: overrides.size ?? 1024 };
}

describe("mediaKindOf", () => {
  it("classifies video/image mime types", () => {
    expect(mediaKindOf("video/mp4")).toBe("video");
    expect(mediaKindOf("image/jpeg")).toBe("image");
  });
});

describe("validatePlatformContent", () => {
  it("requires at least one media asset", () => {
    const issues = validatePlatformContent("facebook", { title: "", caption: "", hashtags: [], media: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe("media-required");
  });

  it("rejects mixing image and video on a platform that does not support it (Facebook)", () => {
    const issues = validatePlatformContent("facebook", { title: "", caption: "", hashtags: [], media: [image(), video()] });
    expect(issues.some((issue) => issue.code === "mixed-media-unsupported")).toBe(true);
  });

  it("allows mixed carousel media on Instagram", () => {
    const issues = validatePlatformContent("instagram", {
      title: "",
      caption: "",
      hashtags: [],
      media: [image({ id: "1" }), video({ id: "2" }), image({ id: "3" })]
    });
    expect(issues.some((issue) => issue.code === "mixed-media-unsupported")).toBe(false);
  });

  it("enforces Instagram carousel max of 10 items", () => {
    const media = Array.from({ length: 11 }, (_, index) => image({ id: `img-${index}` }));
    const issues = validatePlatformContent("instagram", { title: "", caption: "", hashtags: [], media });
    expect(issues.some((issue) => issue.code === "image-count-max")).toBe(true);
  });

  it("rejects PNG images for a TikTok photo post", () => {
    const issues = validatePlatformContent("tiktok", { title: "", caption: "", hashtags: [], media: [image({ mimeType: "image/png" })] });
    expect(issues.some((issue) => issue.code === "image-format")).toBe(true);
  });

  it("requires a title for YouTube", () => {
    const issues = validatePlatformContent("youtube", { title: "", caption: "", hashtags: [], media: [video()] });
    expect(issues.some((issue) => issue.code === "title-required")).toBe(true);
  });

  it("rejects YouTube posts without a video", () => {
    const issues = validatePlatformContent("youtube", { title: "منشور", caption: "", hashtags: [], media: [image()] });
    expect(issues.some((issue) => issue.code === "image-unsupported")).toBe(true);
  });

  it("flags captions longer than the platform limit", () => {
    const capability = getCapabilities("instagram");
    const longCaption = "a".repeat((capability.caption.maxLength ?? 0) + 1);
    const issues = validatePlatformContent("instagram", { title: "", caption: longCaption, hashtags: [], media: [image()] });
    expect(issues.some((issue) => issue.code === "caption-length")).toBe(true);
  });

  it("warns (not errors) when hashtags exceed Instagram's recommended max", () => {
    const hashtags = Array.from({ length: 35 }, (_, index) => `tag${index}`);
    const issues = validatePlatformContent("instagram", { title: "", caption: "", hashtags, media: [image()] });
    const warning = issues.find((issue) => issue.code === "hashtags-recommended");
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe("warning");
  });

  it("rejects alt text longer than Instagram's 1000-character limit", () => {
    const issues = validatePlatformContent("instagram", {
      title: "",
      caption: "",
      hashtags: [],
      media: [image({ altText: "a".repeat(1001) })]
    });
    expect(issues.some((issue) => issue.code === "alt-text-length")).toBe(true);
  });

  it("accepts a single valid image with no issues on Facebook", () => {
    const issues = validatePlatformContent("facebook", { title: "", caption: "منشور تجريبي", hashtags: ["تجربة"], media: [image()] });
    expect(issues).toHaveLength(0);
  });
});
