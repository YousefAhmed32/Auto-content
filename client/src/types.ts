export type Platform = "facebook" | "instagram" | "tiktok" | "youtube";
export type View = "overview" | "compose" | "posts" | "connections";
export type MediaKind = "image" | "video";

export interface MediaAsset {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  kind: MediaKind;
  size: number;
  url: string;
  order: number;
  altText?: string;
  caption?: string;
}

export interface TikTokOverride {
  privacyLevel?: string;
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  coverTimestampMs?: number;
  coverImageIndex?: number;
  brandedContent: boolean;
  brandOrganic: boolean;
}

export interface InstagramOverride {
  coverThumbOffsetMs?: number;
}

export interface YouTubeOverride {
  privacy: "private" | "unlisted" | "public";
}

export interface PlatformOverride {
  useCustomContent: boolean;
  title?: string;
  caption?: string;
  hashtags?: string[];
  mediaOrder?: string[];
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

export type PublishStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";
export type PlatformResultStatus = "pending" | "publishing" | "published" | "failed" | "skipped";

export interface PlatformResult {
  status: PlatformResultStatus;
  externalId?: string;
  url?: string;
  message?: string;
  publishedAt?: string;
  attempts: number;
  lastAttemptAt?: string;
}

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export type PostValidation = Partial<Record<Platform, ValidationIssue[]>>;

export interface PostRecord {
  id: string;
  base: BaseContent;
  platforms: Platform[];
  overrides: Partial<Record<Platform, PlatformOverride>>;
  media: MediaAsset[];
  status: PublishStatus;
  publishMode: "now" | "scheduled";
  scheduledAt?: string;
  timezone?: string;
  platformResults: Partial<Record<Platform, PlatformResult>>;
  createdAt: string;
  updatedAt: string;
  validation?: PostValidation;
}

export interface Connection {
  platform: Platform;
  connected: boolean;
  configured: boolean;
  accountId?: string;
  accountName?: string;
  expiresAt?: string;
  connectedAt?: string;
}

export interface DashboardData {
  metrics: { total: number; published: number; scheduled: number; failures: number; thisMonth: number };
  recentPosts: PostRecord[];
}

export interface MediaCapability {
  formats: string[];
  maxCount: number;
  minCount: number;
  maxFileSizeMb?: number;
  altText: { supported: boolean; maxLength?: number; note: string };
}

export interface VideoCapability {
  formats: string[];
  maxCount: number;
  maxDurationSeconds?: number;
  cover: { supported: boolean; kind?: "timestampMs" | "index"; note: string };
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
