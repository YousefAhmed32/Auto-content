/**
 * مصدر الحقيقة الوحيد لقدرات كل منصة.
 *
 * الواجهة (لإظهار/إخفاء الخيارات) والتحقق على السيرفر (validation) وطبقة الـ adapters
 * يجب أن تعتمد جميعها على هذا الملف بدلًا من نشر أرقام وشروط متفرقة داخل الكود.
 *
 * الأرقام هنا مصدرها إما:
 *  (أ) وثائق رسمية تم التحقق منها وقت الكتابة (موثّقة في `source`)، أو
 *  (ب) حد آمن تفرضه هذه الأداة بنفسها عندما لا تنشر المنصة حدًا رسميًا صارمًا (موثّق بوضوح كـ "app-defined").
 * عند تحديث سياسات أي منصة، حدّث القيم هنا فقط.
 */
import type { MediaKind, Platform } from "./types.js";

export interface AspectRatioGuidance {
  /** أقل نسبة عرض/ارتفاع مقبولة (width/height) قبل تحذير المستخدم - إرشادي وليس رفضًا فعليًا من الـ API. */
  min: number;
  max: number;
  note: string;
}

export interface MediaCapability {
  formats: string[];
  maxCount: number;
  minCount: number;
  maxFileSizeMb?: number;
  altText: { supported: boolean; maxLength?: number; note: string };
  aspectRatio?: AspectRatioGuidance;
}

export interface VideoCapability {
  formats: string[];
  maxCount: number;
  maxDurationSeconds?: number;
  cover: { supported: boolean; kind?: "timestampMs" | "index"; note: string };
  aspectRatio?: AspectRatioGuidance;
}

export interface CarouselCapability {
  supported: boolean;
  minItems: number;
  maxItems: number;
  mixedMedia: boolean;
  note: string;
}

export interface PrivacyOption {
  value: string;
  label: string;
}

export interface PlatformCapabilities {
  platform: Platform;
  label: string;
  image: MediaCapability | null;
  video: VideoCapability | null;
  carousel: CarouselCapability;
  caption: { maxLength: number | null; note: string };
  hashtags: { recommendedMax: number | null; note: string };
  title: { supported: boolean; required: boolean; maxLength?: number; note: string };
  scheduling: { supported: boolean; note: string };
  privacy: { supported: boolean; dynamic: boolean; options?: PrivacyOption[]; note: string };
  comments: { toggle: boolean; note: string };
  duet: { toggle: boolean; note: string };
  stitch: { toggle: boolean; note: string };
  commercialDisclosure: { supported: boolean; note: string };
  coverSelection: { supported: boolean; note: string };
  linkPreview: { supported: boolean; note: string };
  source: string[];
}

const YOUTUBE_PRIVACY_OPTIONS: PrivacyOption[] = [
  { value: "private", label: "خاص" },
  { value: "unlisted", label: "غير مدرج" },
  { value: "public", label: "عام" }
];

export const capabilityMatrix: Record<Platform, PlatformCapabilities> = {
  facebook: {
    platform: "facebook",
    label: "Facebook",
    image: {
      formats: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      maxCount: 10,
      minCount: 1,
      altText: { supported: false, note: "Graph API لا يوفّر حقل alt text عبر نشر منشورات الصفحة." }
    },
    video: {
      formats: ["video/mp4", "video/quicktime"],
      maxCount: 1,
      cover: { supported: false, note: "لا يدعم adapter الحالي اختيار غلاف فيديو Facebook." }
    },
    carousel: {
      supported: true,
      minItems: 2,
      maxItems: 10,
      mixedMedia: false,
      note: "منشور صور متعددة عبر رفع صور غير منشورة (unpublished photos) ثم ربطها بمنشور واحد عبر attached_media. الحد أعلاه سقف تطبيقي آمن وليس حدًا رسميًا موثّقًا من Meta."
    },
    caption: { maxLength: 63206, note: "الحد المعروف والمعلن لطول منشورات Facebook النصية." },
    hashtags: { recommendedMax: null, note: "لا يفرض Facebook حدًا لعدد الهاشتاجات." },
    title: { supported: false, required: false, note: "منشورات صفحات Facebook لا تحتوي حقل عنوان منفصل؛ يُستخدم في سجل النشر فقط." },
    scheduling: { supported: true, note: "جدولة داخلية عبر مجدول هذا التطبيق." },
    privacy: { supported: false, dynamic: false, note: "يُنشر دائمًا حسب إعدادات ظهور الصفحة المرتبطة." },
    comments: { toggle: false, note: "غير مدعوم عبر واجهة النشر الحالية." },
    duet: { toggle: false, note: "غير متاح على Facebook." },
    stitch: { toggle: false, note: "غير متاح على Facebook." },
    commercialDisclosure: { supported: false, note: "غير مطبَّق في هذا التكامل." },
    coverSelection: { supported: false, note: "لا يوجد اختيار غلاف صريح لمنشورات الصور المتعددة؛ الترتيب فقط هو ما يُرسل." },
    linkPreview: { supported: false, note: "لا يرسل adapter الحالي رابطًا منفصلًا لمعاينته." },
    source: [
      "https://developers.facebook.com/docs/graph-api/reference/page/photos/",
      "https://developers.facebook.com/docs/graph-api/reference/page/feed/"
    ]
  },
  instagram: {
    platform: "instagram",
    label: "Instagram",
    image: {
      formats: ["image/jpeg"],
      maxCount: 10,
      minCount: 1,
      maxFileSizeMb: 8,
      altText: { supported: true, maxLength: 1000, note: "alt_text مدعوم للصور فقط (وليس Reels أو Stories) - أُضيف رسميًا في مارس 2025." },
      aspectRatio: { min: 0.8, max: 1.91, note: "توصية Meta لمنشورات الصور: نسبة عرض إلى ارتفاع بين 4:5 (0.8) و1.91:1 - خارج هذا النطاق يُقصّ العرض تلقائيًا، ولا يُرفض النشر." }
    },
    video: {
      formats: ["video/mp4", "video/quicktime"],
      maxCount: 1,
      maxDurationSeconds: 900,
      cover: { supported: true, kind: "timestampMs", note: "thumb_offset بالميلي ثانية لاختيار إطار الغلاف." },
      aspectRatio: { min: 0.5, max: 0.8, note: "Reels تُعرض بشكل أفضل بنسبة رأسية قريبة من 9:16 (≈0.5625) - فيديو أفقي سيُعرض مُقصوصًا أو بحواف سوداء." }
    },
    carousel: {
      supported: true,
      minItems: 2,
      maxItems: 10,
      mixedMedia: true,
      note: "Carousel يقبل حتى 10 صور/فيديوهات مجتمعة؛ يُقصّ كل عنصر حسب أبعاد أول عنصر في التسلسل (افتراضيًا 1:1)."
    },
    caption: { maxLength: 2200, note: "حد Instagram الرسمي لطول الكابشن." },
    hashtags: { recommendedMax: 30, note: "تجاوز 30 هاشتاج لا يفشل النشر لكن قد يقلل الوصول - Instagram توصي بحد أقصى 30." },
    title: { supported: false, required: false, note: "لا يوجد حقل عنوان في منشورات Instagram." },
    scheduling: { supported: true, note: "جدولة داخلية عبر مجدول هذا التطبيق." },
    privacy: { supported: false, dynamic: false, note: "يُنشر بحسب ظهور الحساب (Business/Creator) العام." },
    comments: { toggle: false, note: "غير مدعوم عبر Content Publishing API." },
    duet: { toggle: false, note: "غير متاح على Instagram." },
    stitch: { toggle: false, note: "غير متاح على Instagram." },
    commercialDisclosure: { supported: false, note: "غير مطبَّق في هذا التكامل." },
    coverSelection: { supported: true, note: "لفيديو/Reels عبر thumb_offset فقط؛ الصور والـ carousel تُعرض دون تخصيص غلاف إضافي." },
    linkPreview: { supported: false, note: "لا يقبل محتوى النشر رابطًا مستقلًا." },
    source: [
      "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing",
      "https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/"
    ]
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    image: {
      formats: ["image/jpeg", "image/webp"],
      maxCount: 35,
      minCount: 1,
      maxFileSizeMb: 20,
      altText: { supported: false, note: "Content Posting API لا يعرض حقل alt text." }
    },
    video: {
      formats: ["video/mp4", "video/quicktime", "video/webm"],
      maxCount: 1,
      cover: { supported: true, kind: "timestampMs", note: "video_cover_timestamp_ms لاختيار إطار الغلاف؛ الافتراضي أول إطار." },
      aspectRatio: { min: 0.5, max: 0.8, note: "TikTok مبني على عرض رأسي (يُوصى بحوالي 9:16 ≈0.5625) - فيديو أفقي يظهر بحواف كبيرة." }
    },
    carousel: {
      supported: true,
      minItems: 1,
      maxItems: 35,
      mixedMedia: false,
      note: "منشور صور (PHOTO post_mode) يقبل حتى 35 صورة JPEG/WEBP فقط (لا يقبل PNG) حسب إرشادات TikTok لمحتوى الصور."
    },
    caption: { maxLength: 2200, note: "حد TikTok الرسمي لعنوان/وصف المنشور (2200 UTF-16 rune)." },
    hashtags: { recommendedMax: null, note: "تُحتسب ضمن حد الـ 2200 حرف للنص ذاته." },
    title: { supported: true, required: false, maxLength: 90, note: "سقف تطبيقي احترازي لعنوان منشور الصور (title منفصل عن caption في وضع PHOTO)." },
    scheduling: { supported: true, note: "جدولة داخلية عبر مجدول هذا التطبيق." },
    privacy: {
      supported: true,
      dynamic: true,
      note: "الخيارات المتاحة تُقرأ حيًّا من creator_info/query الخاص بالحساب المتصل (إلزام من TikTok، لا تُحفظ كقائمة ثابتة)."
    },
    comments: { toggle: true, note: "disable_comment - متاح لكل من الفيديو ومنشور الصور." },
    duet: { toggle: true, note: "disable_duet - فيديو فقط (لا ينطبق على منشورات الصور)." },
    stitch: { toggle: true, note: "disable_stitch - فيديو فقط (لا ينطبق على منشورات الصور)." },
    commercialDisclosure: {
      supported: true,
      note: "brand_content_toggle (شراكة مدفوعة) و brand_organic_toggle (ترويج ذاتي). عند تفعيل الشراكة المدفوعة لا يمكن اختيار الخصوصية SELF_ONLY."
    },
    coverSelection: { supported: true, note: "فيديو: video_cover_timestamp_ms. صور: photo_cover_index." },
    linkPreview: { supported: false, note: "غير مطبَّق." },
    source: [
      "https://developers.tiktok.com/doc/content-posting-api-reference-direct-post",
      "https://developers.tiktok.com/doc/content-posting-api-reference-photo-post",
      "https://developers.tiktok.com/doc/content-sharing-guidelines"
    ]
  },
  youtube: {
    platform: "youtube",
    label: "YouTube",
    image: null,
    video: {
      formats: ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
      maxCount: 1,
      cover: { supported: false, note: "لا يدعم adapter الحالي رفع صورة مصغّرة (thumbnail) مخصصة." }
    },
    carousel: { supported: false, minItems: 1, maxItems: 1, mixedMedia: false, note: "YouTube لا يدعم منشورات متعددة الصور - فيديو واحد فقط." },
    caption: { maxLength: 5000, note: "الحد الرسمي لطول وصف الفيديو (description) في YouTube Data API." },
    hashtags: { recommendedMax: null, note: "تُدرج ضمن tags الفيديو دون حد صارم مفروض هنا." },
    title: { supported: true, required: true, maxLength: 100, note: "الحد الرسمي لطول عنوان فيديو YouTube." },
    scheduling: { supported: true, note: "جدولة داخلية عبر مجدول هذا التطبيق (رفع الفيديو يتم عند حلول الموعد)." },
    privacy: { supported: true, dynamic: false, options: YOUTUBE_PRIVACY_OPTIONS, note: "خيارات ثابتة يوفرها YouTube Data API v3 لكل الحسابات." },
    comments: { toggle: false, note: "غير مطبَّق في هذا التكامل." },
    duet: { toggle: false, note: "غير متاح على YouTube." },
    stitch: { toggle: false, note: "غير متاح على YouTube." },
    commercialDisclosure: { supported: false, note: "غير مطبَّق في هذا التكامل." },
    coverSelection: { supported: false, note: "غير مطبَّق حاليًا." },
    linkPreview: { supported: false, note: "غير مطبَّق." },
    source: ["https://developers.google.com/youtube/v3/docs/videos/insert"]
  }
};

export function getCapabilities(platform: Platform): PlatformCapabilities {
  return capabilityMatrix[platform];
}

export function listCapabilities(): PlatformCapabilities[] {
  return platformsInOrder.map((platform) => capabilityMatrix[platform]);
}

const platformsInOrder: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];

export function mediaKindOf(mimeType: string): MediaKind {
  return mimeType.startsWith("video/") ? "video" : "image";
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface PlatformValidationInput {
  title: string;
  caption: string;
  hashtags: string[];
  media: Array<{ id: string; mimeType: string; kind: MediaKind; size: number; altText?: string; width?: number; height?: number }>;
}

/**
 * تحذير إرشادي (لا يمنع النشر) عندما تخرج نسبة أبعاد ملف عن التوصية المسجّلة للمنصة.
 * لا يُطبَّق إلا إذا كانت الأبعاد معروفة فعليًا (تُقرأ في المتصفح وقت الرفع) وكانت المنصة تنشر توصية.
 */
function checkAspectRatio(
  media: { id: string; width?: number; height?: number },
  guidance: AspectRatioGuidance | undefined,
  platformLabel: string
): ValidationIssue | undefined {
  if (!guidance || !media.width || !media.height) return undefined;
  const ratio = media.width / media.height;
  if (ratio >= guidance.min && ratio <= guidance.max) return undefined;
  return {
    code: "aspect-ratio-recommended",
    severity: "warning",
    message: `نسبة أبعاد أحد الملفات (${media.width}×${media.height}) خارج التوصية المناسبة لـ${platformLabel}. ${guidance.note}`
  };
}

/** يتحقق من محتوى منصة واحدة مقابل الـ Capability Matrix. مصدر الثقة النهائي (server-side) قبل أي إرسال حقيقي. */
export function validatePlatformContent(platform: Platform, input: PlatformValidationInput): ValidationIssue[] {
  const capability = getCapabilities(platform);
  const issues: ValidationIssue[] = [];
  const images = input.media.filter((item) => item.kind === "image");
  const videos = input.media.filter((item) => item.kind === "video");

  if (input.media.length === 0) {
    issues.push({ code: "media-required", severity: "error", message: `${capability.label} يحتاج ملف وسائط واحدًا على الأقل.` });
    return issues;
  }

  if (videos.length > 0 && images.length > 0 && !capability.carousel.mixedMedia) {
    issues.push({
      code: "mixed-media-unsupported",
      severity: "error",
      message: `${capability.label} لا يسمح بدمج صور وفيديو في نفس المنشور - اختر نوعًا واحدًا.`
    });
  }

  if (videos.length > 0) {
    if (!capability.video) {
      issues.push({ code: "video-unsupported", severity: "error", message: `${capability.label} لا يدعم نشر الفيديو.` });
    } else if (videos.length > capability.video.maxCount) {
      issues.push({ code: "video-count", severity: "error", message: `${capability.label} يقبل فيديو واحدًا كحد أقصى لكل منشور.` });
    }
    for (const video of videos) {
      if (capability.video && !capability.video.formats.includes(video.mimeType)) {
        issues.push({ code: "video-format", severity: "error", message: `صيغة الفيديو (${video.mimeType}) غير مدعومة على ${capability.label}.` });
      }
      const ratioIssue = capability.video && checkAspectRatio(video, capability.video.aspectRatio, capability.label);
      if (ratioIssue) issues.push(ratioIssue);
    }
  }

  if (images.length > 0) {
    if (!capability.image) {
      issues.push({ code: "image-unsupported", severity: "error", message: `${capability.label} لا يدعم نشر الصور.` });
    } else {
      if (images.length > capability.image.maxCount) {
        issues.push({
          code: "image-count-max",
          severity: "error",
          message: `${capability.label} يقبل ${capability.image.maxCount} صورة كحد أقصى في المنشور الواحد.`
        });
      }
      if (images.length > 1 && images.length < capability.carousel.minItems) {
        issues.push({
          code: "image-count-min",
          severity: "error",
          message: `منشور الصور المتعددة على ${capability.label} يحتاج ${capability.carousel.minItems} صور على الأقل.`
        });
      }
      for (const image of images) {
        if (!capability.image.formats.includes(image.mimeType)) {
          issues.push({ code: "image-format", severity: "error", message: `صيغة الصورة (${image.mimeType}) غير مدعومة على ${capability.label}.` });
        }
        if (capability.image.maxFileSizeMb && image.size > capability.image.maxFileSizeMb * 1024 * 1024) {
          issues.push({
            code: "image-size",
            severity: "error",
            message: `حجم إحدى الصور أكبر من الحد المسموح (${capability.image.maxFileSizeMb}MB) على ${capability.label}.`
          });
        }
        if (image.altText && capability.image.altText.supported && capability.image.altText.maxLength && image.altText.length > capability.image.altText.maxLength) {
          issues.push({
            code: "alt-text-length",
            severity: "error",
            message: `النص البديل لإحدى الصور أطول من الحد المسموح (${capability.image.altText.maxLength} حرف) على ${capability.label}.`
          });
        }
        const ratioIssue = checkAspectRatio(image, capability.image.aspectRatio, capability.label);
        if (ratioIssue) issues.push(ratioIssue);
      }
    }
  }

  if (capability.title.required && !input.title.trim()) {
    issues.push({ code: "title-required", severity: "error", message: `${capability.label} يتطلب عنوانًا للمحتوى.` });
  }
  if (capability.title.maxLength && input.title.length > capability.title.maxLength) {
    issues.push({
      code: "title-length",
      severity: "error",
      message: `عنوان ${capability.label} أطول من الحد المسموح (${capability.title.maxLength} حرف).`
    });
  }

  if (capability.caption.maxLength && input.caption.length > capability.caption.maxLength) {
    issues.push({
      code: "caption-length",
      severity: "error",
      message: `نص ${capability.label} أطول من الحد المسموح (${capability.caption.maxLength} حرف).`
    });
  }

  if (capability.hashtags.recommendedMax && input.hashtags.length > capability.hashtags.recommendedMax) {
    issues.push({
      code: "hashtags-recommended",
      severity: "warning",
      message: `${capability.label} توصي بحد أقصى ${capability.hashtags.recommendedMax} هاشتاج - قد يقل الوصول عند تجاوزها.`
    });
  }

  return issues;
}
