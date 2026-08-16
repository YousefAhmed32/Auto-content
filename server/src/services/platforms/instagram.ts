import axios from "axios";
import { config } from "../../config.js";
import { decrypt } from "../../crypto.js";
import { getConnection } from "../../store.js";
import type { PostRecord } from "../../types.js";
import { formatCaption, resolveContentForPlatform, resolveMediaForPlatform } from "../content.js";
import type { AdapterResult } from "./types.js";

async function waitForContainer(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
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

async function createContainer(igUserId: string, accessToken: string, params: Record<string, string>) {
  const response = await axios.post(
    `https://graph.facebook.com/${config.meta.graphVersion}/${igUserId}/media`,
    new URLSearchParams(params),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const id = response.data?.id as string | undefined;
  if (!id) throw new Error("Instagram لم يُرجع معرّف تجهيز المحتوى");
  return id;
}

export async function publishInstagram(post: PostRecord): Promise<AdapterResult> {
  const connection = await getConnection("instagram");
  if (!connection) throw new Error("حساب Instagram غير متصل");
  if (!config.publicAppUrl.startsWith("https://")) {
    throw new Error("Instagram يحتاج PUBLIC_APP_URL عام يبدأ بـ HTTPS حتى يستطيع قراءة الملف");
  }
  const accessToken = decrypt(connection.accessToken);
  const media = resolveMediaForPlatform(post, "instagram");
  if (!media.length) throw new Error("أضف صورة أو فيديو واحدًا على الأقل لنشره على Instagram");
  const { caption, hashtags } = resolveContentForPlatform(post, "instagram");
  const message = formatCaption(caption, hashtags);
  const override = post.overrides.instagram?.instagram;

  let containerId: string;
  if (media.length === 1) {
    const asset = media[0]!;
    const isVideo = asset.kind === "video";
    const params: Record<string, string> = { access_token: accessToken, caption: message };
    params[isVideo ? "video_url" : "image_url"] = asset.url;
    if (isVideo) {
      params.media_type = "REELS";
      if (override?.coverThumbOffsetMs != null) params.thumb_offset = String(override.coverThumbOffsetMs);
    } else if (asset.altText) {
      params.alt_text = asset.altText.slice(0, 1000);
    }
    containerId = await createContainer(connection.accountId, accessToken, params);
  } else {
    // Carousel: كل عنصر يُجهّز كـcontainer مستقل (is_carousel_item) قبل تجميعه في container أب.
    const childIds = await Promise.all(
      media.map(async (asset) => {
        const isVideo = asset.kind === "video";
        const params: Record<string, string> = { access_token: accessToken, is_carousel_item: "true" };
        params[isVideo ? "video_url" : "image_url"] = asset.url;
        if (!isVideo && asset.altText) params.alt_text = asset.altText.slice(0, 1000);
        const childId = await createContainer(connection.accountId, accessToken, params);
        if (isVideo) await waitForContainer(childId, accessToken);
        return childId;
      })
    );
    containerId = await createContainer(connection.accountId, accessToken, {
      access_token: accessToken,
      media_type: "CAROUSEL",
      caption: message,
      children: childIds.join(",")
    });
  }

  await waitForContainer(containerId, accessToken);
  const published = await axios.post(
    `https://graph.facebook.com/${config.meta.graphVersion}/${connection.accountId}/media_publish`,
    new URLSearchParams({ creation_id: containerId, access_token: accessToken }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const externalId = String(published.data?.id ?? "");
  return { status: "published", externalId, url: "https://www.instagram.com/", publishedAt: new Date().toISOString() };
}
