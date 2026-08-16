import { createReadStream } from "node:fs";
import path from "node:path";
import axios from "axios";
import FormData from "form-data";
import { config } from "../../config.js";
import { decrypt } from "../../crypto.js";
import { getConnection } from "../../store.js";
import type { MediaAsset, PostRecord } from "../../types.js";
import { formatCaption, resolveContentForPlatform, resolveMediaForPlatform } from "../content.js";
import type { AdapterResult } from "./types.js";

function mediaPath(asset: MediaAsset) {
  return path.join(config.uploadsDir, asset.storedName);
}

/** يرفع صورة "غير منشورة" (published=false) استعدادًا لتجميعها ضمن منشور صور متعددة. */
async function uploadUnpublishedPhoto(pageId: string, accessToken: string, asset: MediaAsset) {
  const form = new FormData();
  form.append("access_token", accessToken);
  form.append("published", "false");
  form.append("source", createReadStream(mediaPath(asset)), {
    filename: asset.originalName,
    contentType: asset.mimeType,
    knownLength: asset.size
  });
  const response = await axios.post(`https://graph.facebook.com/${config.meta.graphVersion}/${pageId}/photos`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity
  });
  const id = response.data?.id as string | undefined;
  if (!id) throw new Error("تعذر رفع إحدى الصور إلى Facebook");
  return id;
}

export async function publishFacebook(post: PostRecord): Promise<AdapterResult> {
  const connection = await getConnection("facebook");
  if (!connection) throw new Error("صفحة Facebook غير متصلة");
  const accessToken = decrypt(connection.accessToken);
  const media = resolveMediaForPlatform(post, "facebook");
  if (!media.length) throw new Error("أضف صورة أو فيديو واحدًا على الأقل لنشره على Facebook");
  const { caption, hashtags } = resolveContentForPlatform(post, "facebook");
  const message = formatCaption(caption, hashtags);
  const video = media.find((item) => item.kind === "video");

  if (video) {
    const form = new FormData();
    form.append("access_token", accessToken);
    form.append("description", message);
    form.append("source", createReadStream(mediaPath(video)), {
      filename: video.originalName,
      contentType: video.mimeType,
      knownLength: video.size
    });
    const response = await axios.post(`https://graph.facebook.com/${config.meta.graphVersion}/${connection.accountId}/videos`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity
    });
    const externalId = String(response.data?.id ?? "");
    return {
      status: "published",
      externalId,
      url: externalId ? `https://www.facebook.com/${externalId}` : undefined,
      publishedAt: new Date().toISOString()
    };
  }

  if (media.length === 1) {
    const asset = media[0]!;
    const form = new FormData();
    form.append("access_token", accessToken);
    form.append("caption", message);
    form.append("source", createReadStream(mediaPath(asset)), {
      filename: asset.originalName,
      contentType: asset.mimeType,
      knownLength: asset.size
    });
    const response = await axios.post(`https://graph.facebook.com/${config.meta.graphVersion}/${connection.accountId}/photos`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity
    });
    const externalId = String(response.data?.post_id ?? response.data?.id ?? "");
    return {
      status: "published",
      externalId,
      url: externalId ? `https://www.facebook.com/${externalId.replace("_", "/posts/")}` : undefined,
      publishedAt: new Date().toISOString()
    };
  }

  // منشور صور متعددة: رفع كل صورة كـ"غير منشورة" ثم تجميعها في منشور واحد على /feed.
  const photoIds = await Promise.all(media.map((asset) => uploadUnpublishedPhoto(connection.accountId, accessToken, asset)));
  const feedForm = new URLSearchParams({ access_token: accessToken, message });
  photoIds.forEach((id, index) => feedForm.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: id })));
  const response = await axios.post(`https://graph.facebook.com/${config.meta.graphVersion}/${connection.accountId}/feed`, feedForm, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  const externalId = String(response.data?.id ?? "");
  return {
    status: "published",
    externalId,
    url: externalId ? `https://www.facebook.com/${externalId.replace("_", "/posts/")}` : undefined,
    publishedAt: new Date().toISOString()
  };
}
