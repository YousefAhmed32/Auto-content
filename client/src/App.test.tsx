import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  const payload = url.includes("dashboard")
    ? { metrics: { total: 0, published: 0, scheduled: 0, failures: 0, thisMonth: 0 }, recentPosts: [] }
    : url.includes("connections")
      ? { connections: ["facebook", "instagram", "tiktok", "youtube"].map((platform) => ({ platform, connected: false, configured: false })) }
      : { posts: [] };
  return { ok: true, status: 200, json: async () => payload } as Response;
}));

describe("App", () => {
  it("renders the Arabic workspace heading", async () => {
    render(<App />);
    expect(await screen.findByText("المحتوى كله، من مكان واحد.")).toBeInTheDocument();
  });
});

