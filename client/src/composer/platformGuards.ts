import type { Connection, MediaAsset, MediaKind, Platform, PostRecord } from "../types";

/** المنصات المختارة لكن غير المتصلة بعد - تُستخدم لمنع "النشر الآن" (الجدولة/المسودة تبقى مسموحة). */
export function getUnconnectedSelectedPlatforms(selected: Platform[], connections: Connection[]): Platform[] {
  const connectedSet = new Set(connections.filter((item) => item.connected).map((item) => item.platform));
  return selected.filter((platform) => !connectedSet.has(platform));
}

/** يحدد ما إذا كان المنشور يحمل تخصيصات متقدمة حقيقية (وليس القيم الافتراضية) - لعرض تحذير غير مزعج عند التبديل لوضع بسيط. */
export function hasAdvancedCustomizations(post: PostRecord): boolean {
  return Object.values(post.overrides).some((override) => {
    if (!override) return false;
    if (override.useCustomContent) return true;
    if (override.mediaOrder && override.mediaOrder.length > 0) return true;
    if (override.coverMediaId) return true;
    if (override.tiktok && (override.tiktok.brandedContent || override.tiktok.brandOrganic || override.tiktok.privacyLevel || !override.tiktok.allowComments || !override.tiktok.allowDuet || !override.tiktok.allowStitch)) return true;
    if (override.instagram?.coverThumbOffsetMs) return true;
    if (override.youtube && override.youtube.privacy !== "private") return true;
    return false;
  });
}

/** أول N ملف بحسب الترتيب الأساسي - تُستخدم عند اختيار المستخدم صراحةً "استخدام أول N فقط" لحل تعارض قدرة منصة. */
export function firstNMediaIds(media: MediaAsset[], count: number): string[] {
  return [...media]
    .sort((a, b) => a.order - b.order)
    .slice(0, Math.max(0, count))
    .map((item) => item.id);
}

/**
 * تحل تعارض "عدد الصور/الفيديوهات يتجاوز حد المنصة" بدقة: تُبقي كل الملفات من الأنواع الأخرى كما هي،
 * وتقتصر فقط على أول `maxCount` من النوع المتجاوز للحد (image أو video)، مع الحفاظ على الترتيب الأصلي.
 * هذا يتجنب خطأ إسقاط ملف من النوع الخطأ عند وجود صور وفيديو معًا.
 */
export function truncateMediaForCapability(media: MediaAsset[], kind: MediaKind, maxCount: number): string[] {
  const sorted = [...media].sort((a, b) => a.order - b.order);
  let kindKept = 0;
  const kept: string[] = [];
  for (const item of sorted) {
    if (item.kind === kind) {
      if (kindKept >= maxCount) continue;
      kindKept += 1;
    }
    kept.push(item.id);
  }
  return kept;
}

/** أكواد الأخطاء التي تعني أن نوع/عدد الوسائط لا يناسب المنصة أساسًا (تحتاج قرار المستخدم: استبعاد المنصة أو تقليص الوسائط). */
const MEDIA_CONFLICT_CODES = new Set([
  "image-unsupported",
  "video-unsupported",
  "mixed-media-unsupported",
  "image-count-max",
  "image-count-min",
  "video-count"
]);

export function isMediaConflictIssue(code: string): boolean {
  return MEDIA_CONFLICT_CODES.has(code);
}
