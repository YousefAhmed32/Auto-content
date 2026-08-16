import type { Platform, PlatformOverride } from "../types";

export function defaultOverride(platform: Platform): PlatformOverride {
  const base: PlatformOverride = { useCustomContent: false };
  if (platform === "tiktok") {
    base.tiktok = { allowComments: true, allowDuet: true, allowStitch: true, brandedContent: false, brandOrganic: false };
  }
  if (platform === "youtube") {
    base.youtube = { privacy: "private" };
  }
  return base;
}

export const tiktokPrivacyLabels: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "عام للجميع",
  MUTUAL_FOLLOW_FRIENDS: "المتابعون المتبادلون",
  FOLLOWER_OF_CREATOR: "متابعو الحساب",
  SELF_ONLY: "أنا فقط (خاص)"
};
