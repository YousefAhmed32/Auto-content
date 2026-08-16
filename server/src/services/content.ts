import type { MediaAsset, Platform, PostRecord } from "../types.js";

/** يحل ترتيب/تشكيلة ملفات الوسائط الخاصة بمنصة معينة، مع الرجوع لترتيب الملفات الأساسي إن لم يوجد تخصيص. */
export function resolveMediaForPlatform(post: PostRecord, platform: Platform): MediaAsset[] {
  const override = post.overrides[platform];
  if (override?.mediaOrder?.length) {
    const byId = new Map(post.media.map((item) => [item.id, item]));
    return override.mediaOrder.map((id) => byId.get(id)).filter((item): item is MediaAsset => Boolean(item));
  }
  return [...post.media].sort((a, b) => a.order - b.order);
}

/** يحل العنوان/الكابشن/الهاشتاجات الفعلية لمنصة معينة: التخصيص إن كان مفعّلًا، وإلا المحتوى الأساسي. */
export function resolveContentForPlatform(post: PostRecord, platform: Platform) {
  const override = post.overrides[platform];
  if (override?.useCustomContent) {
    return {
      title: override.title ?? post.base.title,
      caption: override.caption ?? post.base.caption,
      hashtags: override.hashtags ?? post.base.hashtags
    };
  }
  return { title: post.base.title, caption: post.base.caption, hashtags: post.base.hashtags };
}

export function formatCaption(caption: string, hashtags: string[]) {
  const tags = hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  return [caption.trim(), tags].filter(Boolean).join("\n\n");
}
