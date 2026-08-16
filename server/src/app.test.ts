import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

const temp = await mkdtemp(path.join(os.tmpdir(), "yansy-publish-test-"));
process.env.NODE_ENV = "test";
process.env.DATA_FILE = path.join(temp, "store.json");
process.env.UPLOADS_DIR = path.join(temp, "uploads");
const { app } = await import("./app.js");
const { updateStore } = await import("./store.js");

afterAll(async () => rm(temp, { recursive: true, force: true }));

const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

describe("YANSY Publish API", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it("returns all four connection slots", async () => {
    const response = await request(app).get("/api/connections");
    expect(response.status).toBe(200);
    expect(response.body.connections).toHaveLength(4);
  });

  it("exposes the capability matrix for every platform", async () => {
    const response = await request(app).get("/api/capabilities");
    expect(response.status).toBe(200);
    const platforms = response.body.capabilities.map((item: { platform: string }) => item.platform);
    expect(platforms).toEqual(["facebook", "instagram", "tiktok", "youtube"]);
    const instagram = response.body.capabilities.find((item: { platform: string }) => item.platform === "instagram");
    expect(instagram.carousel.maxItems).toBe(10);
  });

  it("creates a draft post with empty media", async () => {
    const response = await request(app).post("/api/posts").send({ title: "مسودة", platforms: ["facebook"] });
    expect(response.status).toBe(201);
    expect(response.body.post.status).toBe("draft");
    expect(response.body.post.media).toEqual([]);
    expect(response.body.post.base.title).toBe("مسودة");
  });

  it("uploads multiple media files, preserving order and assigning ids", async () => {
    const draft = await request(app).post("/api/posts").send({ platforms: ["instagram"] });
    const id = draft.body.post.id;

    const response = await request(app)
      .post(`/api/posts/${id}/media`)
      .attach("media", png1x1, "cover.png")
      .attach("media", png1x1, "step1.png")
      .field("mediaMeta", JSON.stringify([{ altText: "الغلاف" }, { caption: "الخطوة الأولى" }]));

    expect(response.status).toBe(201);
    expect(response.body.post.media).toHaveLength(2);
    expect(response.body.post.media[0].order).toBe(0);
    expect(response.body.post.media[0].altText).toBe("الغلاف");
    expect(response.body.post.media[1].caption).toBe("الخطوة الأولى");
  });

  it("rejects a non-image/video file among the uploaded files", async () => {
    const draft = await request(app).post("/api/posts").send({ platforms: ["facebook"] });
    const id = draft.body.post.id;
    const response = await request(app)
      .post(`/api/posts/${id}/media`)
      .attach("media", Buffer.from("not media"), { filename: "notes.txt", contentType: "text/plain" });
    expect(response.status).toBe(400);
  });

  it("reorders and edits media, then removes one item", async () => {
    const draft = await request(app).post("/api/posts").send({ platforms: ["instagram"] });
    const id = draft.body.post.id;
    const upload = await request(app)
      .post(`/api/posts/${id}/media`)
      .attach("media", png1x1, "a.png")
      .attach("media", png1x1, "b.png");
    const [first, second] = upload.body.post.media;

    const reordered = await request(app)
      .patch(`/api/posts/${id}/media/reorder`)
      .send({ mediaIds: [second.id, first.id] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.post.media.find((m: { id: string }) => m.id === second.id).order).toBe(0);

    const edited = await request(app).patch(`/api/posts/${id}/media/${first.id}`).send({ altText: "نص بديل" });
    expect(edited.body.post.media.find((m: { id: string }) => m.id === first.id).altText).toBe("نص بديل");

    const removed = await request(app).delete(`/api/posts/${id}/media/${first.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.post.media).toHaveLength(1);
  });

  it("sanitizes platform overrides, dropping unknown platforms and unknown fields", async () => {
    const draft = await request(app).post("/api/posts").send({ platforms: ["tiktok"] });
    const id = draft.body.post.id;
    const response = await request(app)
      .patch(`/api/posts/${id}`)
      .send({
        platforms: ["tiktok"],
        overrides: {
          tiktok: { useCustomContent: true, caption: "نص TikTok", tiktok: { allowComments: false, privacyLevel: "SELF_ONLY", brandedContent: "yes" }, evilField: "<script>" },
          notAPlatform: { useCustomContent: true }
        }
      });
    expect(response.status).toBe(200);
    expect(response.body.post.overrides.notAPlatform).toBeUndefined();
    expect(response.body.post.overrides.tiktok.caption).toBe("نص TikTok");
    expect(response.body.post.overrides.tiktok.tiktok.allowComments).toBe(false);
    expect(response.body.post.overrides.tiktok.tiktok.brandedContent).toBe(true);
    expect(response.body.post.overrides.tiktok.evilField).toBeUndefined();
  });

  it("blocks scheduling in the past and accepts a valid future date", async () => {
    const draft = await request(app).post("/api/posts").send({ platforms: ["facebook"] });
    const id = draft.body.post.id;

    const past = await request(app).patch(`/api/posts/${id}`).send({ publishMode: "scheduled", scheduledAt: new Date(Date.now() - 60_000).toISOString() });
    expect(past.status).toBe(400);

    const future = await request(app).patch(`/api/posts/${id}`).send({ publishMode: "scheduled", scheduledAt: new Date(Date.now() + 3_600_000).toISOString() });
    expect(future.status).toBe(200);
    expect(future.body.post.status).toBe("scheduled");
  });

  it("reports per-platform validation issues without requiring a real publish attempt", async () => {
    const draft = await request(app).post("/api/posts").send({ platforms: ["youtube"] });
    const id = draft.body.post.id;
    await request(app).post(`/api/posts/${id}/media`).attach("media", png1x1, "cover.png");

    const validation = await request(app).get(`/api/posts/${id}/validate`);
    expect(validation.status).toBe(200);
    expect(validation.body.ready).toBe(false);
    expect(validation.body.validation.youtube.some((issue: { code: string }) => issue.code === "image-unsupported")).toBe(true);
  });

  it("prevents editing a post once it is no longer draft/scheduled", async () => {
    const draft = await request(app).post("/api/posts").send({ platforms: ["facebook"] });
    const id = draft.body.post.id;
    await updateStore((store) => {
      const post = store.posts.find((item) => item.id === id);
      if (post) post.status = "published";
    });

    const response = await request(app).patch(`/api/posts/${id}`).send({ title: "تعديل ممنوع" });
    expect(response.status).toBe(409);
  });

  it("deletes a post and returns 404 afterwards", async () => {
    const draft = await request(app).post("/api/posts").send({ platforms: ["facebook"] });
    const id = draft.body.post.id;
    const deleted = await request(app).delete(`/api/posts/${id}`);
    expect(deleted.status).toBe(204);
    const missing = await request(app).get(`/api/posts/${id}`);
    expect(missing.status).toBe(404);
  });
});
