import { createReadStream } from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { config } from "../../config.js";
import type { PostRecord } from "../../types.js";
import { formatCaption, resolveContentForPlatform, resolveMediaForPlatform } from "../content.js";
import { getGoogleAuthClient } from "../oauth.js";
import type { AdapterResult } from "./types.js";

export async function publishYouTube(post: PostRecord): Promise<AdapterResult> {
  const media = resolveMediaForPlatform(post, "youtube");
  const video = media.find((item) => item.kind === "video");
  if (!video) throw new Error("YouTube يقبل الفيديو فقط في هذه النسخة - أضف ملف فيديو للنشر");
  const { title, caption, hashtags } = resolveContentForPlatform(post, "youtube");
  const override = post.overrides.youtube?.youtube;
  const auth = await getGoogleAuthClient();
  const youtube = google.youtube({ version: "v3", auth });
  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description: formatCaption(caption, hashtags),
        tags: hashtags.map((tag) => tag.replace(/^#/, "")),
        categoryId: "22"
      },
      status: { privacyStatus: override?.privacy ?? "private" }
    },
    media: { mimeType: video.mimeType, body: createReadStream(path.join(config.uploadsDir, video.storedName)) }
  });
  const externalId = response.data.id ?? "";
  return {
    status: "published",
    externalId,
    url: externalId ? `https://youtu.be/${externalId}` : undefined,
    publishedAt: new Date().toISOString()
  };
}
