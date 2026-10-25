import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThinkNet API client", () => {
  it("returns parsed JSON for a successful request", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", service: "thinknet-backend", torch_version: "2.x" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.health()).resolves.toMatchObject({
      status: "ok",
      service: "thinknet-backend",
    });
  });

  it("surfaces structured backend validation errors", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: { errors: ["Graph requires an Input node."] } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Graph requires an Input node.",
    });
  });

  it("turns malformed JSON into an actionable API error", async () => {
    mockFetch.mockResolvedValue(
      new Response("{not-json", {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      message: expect.stringContaining("invalid JSON"),
    });
  });

  it("rejects empty successful responses instead of pretending they are data", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.health()).rejects.toMatchObject({
      name: "ApiError",
      status: 204,
      message: expect.stringContaining("empty response"),
    });
  });

  it("explains when the local backend cannot be reached", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await api.health().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as Error).message).toContain("Cannot reach the ThinkNet backend");
    expect((error as ApiError).status).toBe(0);
  });
});
