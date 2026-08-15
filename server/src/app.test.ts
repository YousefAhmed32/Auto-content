import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const temp = await mkdtemp(path.join(os.tmpdir(), "yansy-publish-test-"));
process.env.NODE_ENV = "test";
process.env.DATA_FILE = path.join(temp, "store.json");
process.env.UPLOADS_DIR = path.join(temp, "uploads");
const { app } = await import("./app.js");

beforeAll(() => undefined);
afterAll(async () => rm(temp, { recursive: true, force: true }));

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

  it("validates media when creating a post", async () => {
    const response = await request(app).post("/api/posts").field("title", "اختبار");
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("صورة أو فيديو");
  });
});

