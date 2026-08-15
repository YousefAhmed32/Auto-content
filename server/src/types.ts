export const platforms = ["facebook", "instagram", "tiktok", "youtube"] as const;
export type Platform = (typeof platforms)[number];

export type PublishStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";
export type PlatformResultStatus = "pending" | "publishing" | "published" | "failed";

export interface MediaAsset {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface PlatformResult {
  status: PlatformResultStatus;
  externalId?: string;
  url?: string;
  message?: string;
  publishedAt?: string;
}

export interface PostRecord {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  platforms: Platform[];
  media: MediaAsset;
  status: PublishStatus;
  publishMode: "now" | "scheduled";
  scheduledAt?: string;
  youtubePrivacy: "private" | "unlisted" | "public";
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

