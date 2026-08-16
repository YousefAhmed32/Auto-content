import type {
  Connection,
  DashboardData,
  Platform,
  PlatformCapabilities,
  PostRecord,
  PostValidation,
  TikTokCreatorInfo
} from "./types";

export * from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "تعذر الاتصال بالخادم" }));
    const error = new Error(payload.message ?? "حدث خطأ غير متوقع") as Error & { validation?: PostValidation };
    if (payload.validation) error.validation = payload.validation;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function json(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const api = {
  dashboard: () => request<DashboardData>("/api/dashboard"),
  posts: () => request<{ posts: PostRecord[] }>("/api/posts"),
  post: (id: string) => request<{ post: PostRecord }>(`/api/posts/${id}`),
  validate: (id: string) => request<{ validation: PostValidation; ready: boolean }>(`/api/posts/${id}/validate`),
  capabilities: () => request<{ capabilities: PlatformCapabilities[] }>("/api/capabilities"),
  tiktokCreatorInfo: () => request<TikTokCreatorInfo>("/api/tiktok/creator-info"),
  connections: () => request<{ connections: Connection[] }>("/api/connections"),

  createDraft: (body: { title?: string; caption?: string; hashtags?: string[]; platforms?: Platform[] }) =>
    request<{ post: PostRecord }>("/api/posts", json(body)),

  updatePost: (id: string, body: Record<string, unknown>) =>
    request<{ post: PostRecord }>(`/api/posts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),

  deletePost: (id: string) => request<void>(`/api/posts/${id}`, { method: "DELETE" }),

  uploadMedia: (id: string, files: File[], meta: Array<{ altText?: string; caption?: string }>, onProgress?: (percent: number) => void) =>
    new Promise<{ post: PostRecord }>((resolve, reject) => {
      const body = new FormData();
      files.forEach((file) => body.append("media", file));
      body.append("mediaMeta", JSON.stringify(meta));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/posts/${id}/media`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        let payload: unknown;
        try { payload = JSON.parse(xhr.responseText); } catch { payload = null; }
        if (xhr.status >= 200 && xhr.status < 300 && payload) {
          resolve(payload as { post: PostRecord });
        } else {
          const message = (payload as { message?: string } | null)?.message ?? "تعذر رفع الملفات";
          const error = new Error(message) as Error & { validation?: PostValidation };
          const validation = (payload as { validation?: PostValidation } | null)?.validation;
          if (validation) error.validation = validation;
          reject(error);
        }
      };
      xhr.onerror = () => reject(new Error("تعذر الاتصال بالخادم أثناء رفع الملفات"));
      xhr.send(body);
    }),
  reorderMedia: (id: string, mediaIds: string[]) =>
    request<{ post: PostRecord }>(`/api/posts/${id}/media/reorder`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaIds }) }),
  updateMedia: (id: string, mediaId: string, body: { altText?: string; caption?: string }) =>
    request<{ post: PostRecord }>(`/api/posts/${id}/media/${mediaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  removeMedia: (id: string, mediaId: string) =>
    request<{ post: PostRecord }>(`/api/posts/${id}/media/${mediaId}`, { method: "DELETE" }),

  publish: (id: string) => request<{ post: PostRecord }>(`/api/posts/${id}/publish`, { method: "POST" }),
  publishPlatform: (id: string, platform: Platform) => request<{ post: PostRecord }>(`/api/posts/${id}/publish/${platform}`, { method: "POST" }),

  authorizationUrl: (platform: Platform) => request<{ url: string }>(`/api/auth/${platform}/url`),
  disconnect: (platform: Platform) => request<void>(`/api/connections/${platform}`, { method: "DELETE" })
};
