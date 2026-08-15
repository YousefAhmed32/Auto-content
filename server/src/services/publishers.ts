import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import axios from "axios";
import FormData from "form-data";
import { google } from "googleapis";
import { config } from "../config.js";
import { decrypt } from "../crypto.js";
import { getConnection } from "../store.js";
import type { Platform, PlatformResult, PostRecord } from "../types.js";
import { getGoogleAuthClient } from "./oauth.js";

function mediaPath(post: PostRecord) {
  return path.join(config.uploadsDir, post.media.storedName);
}

function caption(post: PostRecord) {
  const tags = post.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  return [post.caption.trim(), tags].filter(Boolean).join("\n\n");
}

async function publishFacebook(post: PostRecord): Promise<PlatformResult> {
  const connection = await getConnection("facebook");
  if (!connection) throw new Error("صفحة Facebook غير متصلة");
  const accessToken = decrypt(connection.accessToken);
  const isVideo = post.media.mimeType.startsWith("video/");
  const endpoint = `https://graph.facebook.com/${config.meta.graphVersion}/${connection.accountId}/${isVideo ? "videos" : "photos"}`;
  const form = new FormData();
  form.append("access_token", accessToken);
  form.append(isVideo ? "description" : "caption", caption(post));
  form.append("source", createReadStream(mediaPath(post)), {
    filename: post.media.originalName,
    contentType: post.media.mimeType,
    knownLength: post.media.size
  });
  const response = await axios.post(endpoint, form, { headers: form.getHeaders(), maxBodyLength: Infinity });
  const externalId = String(response.data?.post_id ?? response.data?.id ?? "");
  return {
    status: "published",
    externalId,
    url: externalId ? `https://www.facebook.com/${externalId.replace("_", "/posts/")}` : undefined,
    publishedAt: new Date().toISOString()
  };
}

async function waitForInstagramContainer(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await axios.get(`https://graph.facebook.com/${config.meta.graphVersion}/${containerId}`, {
      params: { fields: "status_code,status", access_token: accessToken }
    });
    const status = response.data?.status_code;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new Error(response.data?.status ?? "Instagram لم يعالج الملف");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("انتهت مهلة معالجة Instagram للملف");
}

async function publishInstagram(post: PostRecord): Promise<PlatformResult> {
  const connection = await getConnection("instagram");
  if (!connection) throw new Error("حساب Instagram غير متصل");
  if (!config.publicAppUrl.startsWith("https://")) {
    throw new Error("Instagram يحتاج PUBLIC_APP_URL عام يبدأ بـ HTTPS حتى يستطيع قراءة الملف");
  }
  const accessToken = decrypt(connection.accessToken);
  const isVideo = post.media.mimeType.startsWith("video/");
  const params: Record<string, string> = {
    access_token: accessToken,
    caption: caption(post),
    [isVideo ? "video_url" : "image_url"]: post.media.url
  };
  if (isVideo) params.media_type = "REELS";
  const container = await axios.post(
    `https://graph.facebook.com/${config.meta.graphVersion}/${connection.accountId}/media`,
    new URLSearchParams(params),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const containerId = container.data?.id as string | undefined;
  if (!containerId) throw new Error("Instagram لم يُرجع معرّف تجهيز المحتوى");
  await waitForInstagramContainer(containerId, accessToken);
  const published = await axios.post(
    `https://graph.facebook.com/${config.meta.graphVersion}/${connection.accountId}/media_publish`,
    new URLSearchParams({ creation_id: containerId, access_token: accessToken }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const externalId = String(published.data?.id ?? "");
  return {
    status: "published",
    externalId,
    url: "https://www.instagram.com/",
    publishedAt: new Date().toISOString()
  };
}

async function publishYouTube(post: PostRecord): Promise<PlatformResult> {
  if (!post.media.mimeType.startsWith("video/")) throw new Error("YouTube يقبل الفيديو فقط في هذه النسخة");
  const auth = await getGoogleAuthClient();
  const youtube = google.youtube({ version: "v3", auth });
  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: post.title.slice(0, 100),
        description: caption(post),
        tags: post.hashtags.map((tag) => tag.replace(/^#/, "")),
        categoryId: "22"
      },
      status: { privacyStatus: post.youtubePrivacy }
    },
    media: { mimeType: post.media.mimeType, body: createReadStream(mediaPath(post)) }
  });
  const externalId = response.data.id ?? "";
  return {
    status: "published",
    externalId,
    url: externalId ? `https://youtu.be/${externalId}` : undefined,
    publishedAt: new Date().toISOString()
  };
}

async function publishTikTok(post: PostRecord): Promise<PlatformResult> {
  const connection = await getConnection("tiktok");
  if (!connection) throw new Error("حساب TikTok غير متصل");
  const accessToken = decrypt(connection.accessToken);
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" };
  const creator = await axios.post("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {}, { headers });
  const privacyOptions = creator.data?.data?.privacy_level_options as string[] | undefined;
  const privacyLevel = privacyOptions?.includes("PUBLIC_TO_EVERYONE")
    ? "PUBLIC_TO_EVERYONE"
    : privacyOptions?.[0] ?? "SELF_ONLY";

  if (post.media.mimeType.startsWith("video/")) {
    const fileSize = statSync(mediaPath(post)).size;
    const preferredChunkSize = 10 * 1024 * 1024;
    const totalChunks = fileSize <= 64 * 1024 * 1024 ? 1 : Math.ceil(fileSize / preferredChunkSize);
    const chunkSize = Math.ceil(fileSize / totalChunks);
    const init = await axios.post("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      post_info: {
        title: caption(post).slice(0, 2200),
        privacy_level: privacyLevel,
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: fileSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks
      }
    }, { headers });
    const uploadUrl = init.data?.data?.upload_url as string | undefined;
    const publishId = init.data?.data?.publish_id as string | undefined;
    if (!uploadUrl || !publishId) throw new Error(init.data?.error?.message ?? "TikTok لم يبدأ رفع الفيديو");
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, fileSize) - 1;
      const currentSize = end - start + 1;
      await axios.put(uploadUrl, createReadStream(mediaPath(post), { start, end }), {
        headers: {
          "Content-Type": post.media.mimeType,
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
  const init = await axios.post("https://open.tiktokapis.com/v2/post/publish/content/init/", {
    post_info: {
      title: post.title.slice(0, 90),
      description: caption(post).slice(0, 4000),
      privacy_level: privacyLevel,
      disable_comment: false
    },
    source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: [post.media.url] },
    post_mode: "DIRECT_POST",
    media_type: "PHOTO"
  }, { headers });
  const publishId = init.data?.data?.publish_id as string | undefined;
  if (!publishId) throw new Error(init.data?.error?.message ?? "TikTok لم يبدأ نشر الصورة");
  return { status: "published", externalId: publishId, url: "https://www.tiktok.com/", publishedAt: new Date().toISOString() };
}

export async function publishToPlatform(platform: Platform, post: PostRecord) {
  if (platform === "facebook") return publishFacebook(post);
  if (platform === "instagram") return publishInstagram(post);
  if (platform === "youtube") return publishYouTube(post);
  return publishTikTok(post);
}
