import type { Platform, PostRecord } from "../../types.js";
import { publishFacebook } from "./facebook.js";
import { publishInstagram } from "./instagram.js";
import { getTikTokCreatorInfo, publishTikTok } from "./tiktok.js";
import type { AdapterResult, PlatformAdapter } from "./types.js";
import { publishYouTube } from "./youtube.js";

const adapters: Record<Platform, PlatformAdapter> = {
  facebook: publishFacebook,
  instagram: publishInstagram,
  tiktok: publishTikTok,
  youtube: publishYouTube
};

export async function publishToPlatform(platform: Platform, post: PostRecord): Promise<AdapterResult> {
  return adapters[platform](post);
}

export { getTikTokCreatorInfo };
export type { AdapterResult };
