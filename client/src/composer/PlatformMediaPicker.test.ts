import { describe, expect, it } from "vitest";
import { resolvedMediaFor } from "./PlatformMediaPicker";
import type { MediaAsset } from "../types";

function asset(id: string, order: number): MediaAsset {
  return { id, originalName: `${id}.jpg`, storedName: `${id}.jpg`, mimeType: "image/jpeg", kind: "image", size: 10, url: `https://x/${id}`, order };
}

describe("resolvedMediaFor", () => {
  const media = [asset("cover", 0), asset("step1", 1), asset("step2", 2), asset("result", 3)];

  it("returns all media sorted by base order when no per-platform order is given", () => {
    const shuffled = [media[2]!, media[0]!, media[3]!, media[1]!];
    expect(resolvedMediaFor(shuffled, undefined).map((item) => item.id)).toEqual(["cover", "step1", "step2", "result"]);
  });

  it("returns only the ids present in the platform-specific order, in that order", () => {
    expect(resolvedMediaFor(media, ["result", "cover"]).map((item) => item.id)).toEqual(["result", "cover"]);
  });

  it("ignores stale ids that no longer exist in the media library", () => {
    expect(resolvedMediaFor(media, ["cover", "deleted-id", "result"]).map((item) => item.id)).toEqual(["cover", "result"]);
  });

  it("falls back to base order for an empty override array", () => {
    expect(resolvedMediaFor(media, []).map((item) => item.id)).toEqual(["cover", "step1", "step2", "result"]);
  });
});
