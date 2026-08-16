import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import axios from "axios";
import { config } from "../../config.js";
import { decrypt } from "../../crypto.js";
import { getConnection } from "../../store.js";
import type { MediaAsset, PostRecord } from "../../types.js";
import { formatCaption, resolveContentForPlatform, resolveMediaForPlatform } from "../content.js";
import type { AdapterResult } from "./types.js";

function mediaPath(asset: MediaAsset) {
  return path.join(config.uploadsDir, asset.storedName);
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" };
}

export interface TikTokCreatorInfo {
  privacyOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec?: number;
  creatorUsername?: string;
  creatorNickname?: string;
  creatorAvatarUrl?: string;
}

/**
 * TikTok يشترط استعلام creator_info وعرض خياراته الحقيقية (خصوصية/تعليقات...) للمستخدم قبل النشر،
 * بدل افتراض قيم ثابتة - هذا إلزام في إرشادات مشاركة المحتوى الخاصة بهم.
 */
export async function getTikTokCreatorInfo(): Promise<TikTokCreatorInfo> {
  const connection = await getConnection("tiktok");
  if (!connection) throw new Error("حساب TikTok غير متصل");
  const accessToken = decrypt(connection.accessToken);
  const response = await axios.post(
    "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
    {},
    { headers: authHeaders(accessToken) }
  );
  const data = response.data?.data;
  if (!data) throw new Error(response.data?.error?.message ?? "تعذر قراءة إعدادات إنشاء المحتوى لحساب TikTok");
  return {
    privacyOptions: (data.privacy_level_options as string[]) ?? [],
    commentDisabled: Boolean(data.comment_disabled),
    duetDisabled: Boolean(data.duet_disabled),
    stitchDisabled: Boolean(data.stitch_disabled),
    maxVideoPostDurationSec: data.max_video_post_duration_sec as number | undefined,
    creatorUsername: data.creator_username as string | undefined,
    creatorNickname: data.creator_nickname as string | undefined,
    creatorAvatarUrl: data.creator_avatar_url as string | undefined
  };
}

export async function publishTikTok(post: PostRecord): Promise<AdapterResult> {
  const connection = await getConnection("tiktok");
  if (!connection) throw new Error("حساب TikTok غير متصل");
  const accessToken = decrypt(connection.accessToken);
  const media = resolveMediaForPlatform(post, "tiktok");
  if (!media.length) throw new Error("أضف فيديو أو صورة واحدة على الأقل لنشرها على TikTok");
  const { title, caption, hashtags } = resolveContentForPlatform(post, "tiktok");
  const override = post.overrides.tiktok?.tiktok;
  const headers = authHeaders(accessToken);

  const creator = await axios.post("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {}, { headers });
  const privacyOptions = (creator.data?.data?.privacy_level_options as string[] | undefined) ?? [];
  let privacyLevel = override?.privacyLevel && privacyOptions.includes(override.privacyLevel)
    ? override.privacyLevel
    : privacyOptions.includes("PUBLIC_TO_EVERYONE")
      ? "PUBLIC_TO_EVERYONE"
      : (privacyOptions[0] ?? "SELF_ONLY");

  const brandedContent = override?.brandedContent ?? false;
  const brandOrganic = override?.brandOrganic ?? false;
  if (brandedContent && privacyLevel === "SELF_ONLY") {
    // شراكة مدفوعة (brand_content_toggle) لا يمكن أن تكون خاصة بالكامل حسب سياسة TikTok.
    privacyLevel = privacyOptions.find((option) => option !== "SELF_ONLY") ?? privacyLevel;
  }

  const video = media.find((item) => item.kind === "video");

  if (video) {
    const fileSize = statSync(mediaPath(video)).size;
    const preferredChunkSize = 10 * 1024 * 1024;
    const totalChunks = fileSize <= 64 * 1024 * 1024 ? 1 : Math.ceil(fileSize / preferredChunkSize);
    const chunkSize = Math.ceil(fileSize / totalChunks);
    const init = await axios.post(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        post_info: {
          title: formatCaption(caption, hashtags).slice(0, 2200),
          privacy_level: privacyLevel,
          disable_comment: !(override?.allowComments ?? true),
          disable_duet: !(override?.allowDuet ?? true),
          disable_stitch: !(override?.allowStitch ?? true),
          video_cover_timestamp_ms: override?.coverTimestampMs ?? 1000,
          brand_content_toggle: brandedContent,
          brand_organic_toggle: brandOrganic
        },
        source_info: { source: "FILE_UPLOAD", video_size: fileSize, chunk_size: chunkSize, total_chunk_count: totalChunks }
      },
      { headers }
    );
    const uploadUrl = init.data?.data?.upload_url as string | undefined;
    const publishId = init.data?.data?.publish_id as string | undefined;
    if (!uploadUrl || !publishId) throw new Error(init.data?.error?.message ?? "TikTok لم يبدأ رفع الفيديو");
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, fileSize) - 1;
      const currentSize = end - start + 1;
      await axios.put(uploadUrl, createReadStream(mediaPath(video), { start, end }), {
        headers: {
          "Content-Type": video.mimeType,
          "Content-Length": currentSize,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`
        },
        maxBodyLength: Infinity
      });
    }
    return { status: "published", externalId: publishId, url: "https://www.tiktok.com/", publishedAt: new Date().toISOString() };
  }

  if (!config.publicAppUrl.startsWith("https://")) {
    throw new Error("نشر صور TikTok يحتاج PUBLIC_APP_URL عام ومُوثّق يبدأ بـ HTTPS");
  }
  const images = media.filter((item) => item.kind === "image");
  const init = await axios.post(
    "https://open.tiktokapis.com/v2/post/publish/content/init/",
    {
      post_info: {
        title: title.slice(0, 90),
        description: formatCaption(caption, hashtags).slice(0, 2200),
        privacy_level: privacyLevel,
        disable_comment: !(override?.allowComments ?? true),
        brand_content_toggle: brandedContent,
        brand_organic_toggle: brandOrganic
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: override?.coverImageIndex ?? 0,
        photo_images: images.map((item) => item.url)
      },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO"
    },
    { headers }
  );
  const publishId = init.data?.data?.publish_id as string | undefined;
  if (!publishId) throw new Error(init.data?.error?.message ?? "TikTok لم يبدأ نشر الصور");
  return { status: "published", externalId: publishId, url: "https://www.tiktok.com/", publishedAt: new Date().toISOString() };
}
