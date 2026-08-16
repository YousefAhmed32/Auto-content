import type { PlatformResult, PostRecord } from "../../types.js";

export type AdapterResult = Omit<PlatformResult, "attempts" | "lastAttemptAt">;
export type PlatformAdapter = (post: PostRecord) => Promise<AdapterResult>;
