export type Platform = "facebook" | "instagram" | "tiktok" | "youtube";
export type View = "overview" | "compose" | "posts" | "connections";

export interface PlatformResult {
  status: "pending" | "publishing" | "published" | "failed";
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
  media: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
  };
  status: "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";
  publishMode: "now" | "scheduled";
  scheduledAt?: string;
  youtubePrivacy: "private" | "unlisted" | "public";
  platformResults: Partial<Record<Platform, PlatformResult>>;
  createdAt: string;
  updatedAt: string;
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "تعذر الاتصال بالخادم" }));
    throw new Error(payload.message ?? "حدث خطأ غير متوقع");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<DashboardData>("/api/dashboard"),
  posts: () => request<{ posts: PostRecord[] }>("/api/posts"),
  connections: () => request<{ connections: Connection[] }>("/api/connections"),
  createPost: (body: FormData) => request<{ post: PostRecord }>("/api/posts", { method: "POST", body }),
  retryPost: (id: string) => request<{ post: PostRecord }>(`/api/posts/${id}/publish`, { method: "POST" }),
  deletePost: (id: string) => request<void>(`/api/posts/${id}`, { method: "DELETE" }),
  authorizationUrl: (platform: Platform) => request<{ url: string }>(`/api/auth/${platform}/url`),
  disconnect: (platform: Platform) => request<void>(`/api/connections/${platform}`, { method: "DELETE" })
};

