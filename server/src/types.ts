export const platforms = ["facebook", "instagram", "tiktok", "youtube"] as const;
export type Platform = (typeof platforms)[number];

export type PublishStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";
export type PlatformResultStatus = "pending" | "publishing" | "published" | "failed" | "skipped";
export type MediaKind = "image" | "video";

export interface MediaAsset {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  kind: MediaKind;
  size: number;
  url: string;
  /** موضع الملف داخل التسلسل الأساسي (يحدد ترتيب السحب والإفلات). */
  order: number;
  /** نص بديل لإتاحة الوصول - يُرسل فعليًا فقط للمنصات التي تدعمه (صور Instagram). */
  altText?: string;
  /** ملاحظة داخلية على الملف (مثال: "صورة المكوّنات" لمحتوى وصفة) - لا تُرسل لأي API. */
  caption?: string;
}

export interface PlatformResult {
  status: PlatformResultStatus;
  externalId?: string;
  url?: string;
  message?: string;
  publishedAt?: string;
  /** عدد محاولات النشر التي جرت لهذه المنصة على هذا المنشور. */
  attempts: number;
  lastAttemptAt?: string;
}

export interface TikTokOverride {
  /** يُختار من الخيارات الفعلية التي يرجعها creator_info/query الخاص بالحساب المتصل. */
  privacyLevel?: string;
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  /** غلاف الفيديو: أوفست بالميلي ثانية. */
  coverTimestampMs?: number;
  /** غلاف منشور الصور: انديكس الصورة المستخدمة كغلاف. */
  coverImageIndex?: number;
  /** brand_content_toggle: يروّج لعلامة تجارية/جهة ثالثة (شراكة مدفوعة). */
  brandedContent: boolean;
  /** brand_organic_toggle: يروّج لعمل صاحب الحساب نفسه. */
  brandOrganic: boolean;
}

export interface InstagramOverride {
  /** غلاف الفيديو/الريلز: أوفست بالميلي ثانية (thumb_offset). */
  coverThumbOffsetMs?: number;
}

export interface YouTubeOverride {
  privacy: "private" | "unlisted" | "public";
}

export interface PlatformOverride {
  /** إن كانت false يُستخدم المحتوى الأساسي مباشرة بدون أي تخصيص. */
  useCustomContent: boolean;
  title?: string;
  caption?: string;
  hashtags?: string[];
  /** ترتيب/تشكيلة ملفات الوسائط الخاصة بهذه المنصة (معرّفات من post.media)؛ فارغة = استخدام كل الوسائط بترتيبها الأساسي. */
  mediaOrder?: string[];
  /** معرّف الملف المستخدم كغلاف عند دعم المنصة لاختيار غلاف. */
  coverMediaId?: string;
  tiktok?: TikTokOverride;
  instagram?: InstagramOverride;
  youtube?: YouTubeOverride;
}

export interface BaseContent {
  title: string;
  caption: string;
  hashtags: string[];
}

export interface PostRecord {
  id: string;
  base: BaseContent;
  platforms: Platform[];
  overrides: Partial<Record<Platform, PlatformOverride>>;
  media: MediaAsset[];
  status: PublishStatus;
  publishMode: "now" | "scheduled";
  scheduledAt?: string;
  /** المنطقة الزمنية IANA المستخدمة عند اختيار موعد الجدولة من الواجهة (للعرض فقط، التخزين دائمًا UTC). */
  timezone?: string;
  platformResults: Partial<Record<Platform, PlatformResult>>;
  createdAt: string;
  updatedAt: string;
}

export interface StoredConnection {
  platform: Platform;
  connected: boolean;
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  metadata?: Record<string, string>;
  connectedAt: string;
}

export interface PublicConnection {
  platform: Platform;
  connected: boolean;
  accountId?: string;
  accountName?: string;
  expiresAt?: string;
  connectedAt?: string;
  configured: boolean;
}

export interface StoreShape {
  posts: PostRecord[];
  connections: StoredConnection[];
}
