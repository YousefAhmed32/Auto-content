import { validatePlatformContent, type ValidationIssue } from "../capabilities.js";
import type { Platform, PostRecord } from "../types.js";
import { resolveContentForPlatform, resolveMediaForPlatform } from "./content.js";

export type PostValidation = Partial<Record<Platform, ValidationIssue[]>>;

/** التحقق النهائي (مصدر الثقة) لكل منصة مختارة في المنشور، باستخدام Capability Matrix المركزية. */
export function validatePost(post: PostRecord): PostValidation {
  const result: PostValidation = {};
  for (const platform of post.platforms) {
    const { title, caption, hashtags } = resolveContentForPlatform(post, platform);
    const media = resolveMediaForPlatform(post, platform).map((asset) => ({
      id: asset.id,
      mimeType: asset.mimeType,
      kind: asset.kind,
      size: asset.size,
      altText: asset.altText
    }));
    result[platform] = validatePlatformContent(platform, { title, caption, hashtags, media });
  }
  return result;
}

export function hasBlockingErrors(issues: PostValidation) {
  return Object.values(issues).some((list) => list?.some((issue) => issue.severity === "error"));
}

export function firstErrorMessage(issues: PostValidation) {
  for (const list of Object.values(issues)) {
    const error = list?.find((issue) => issue.severity === "error");
    if (error) return error.message;
  }
  return undefined;
}
