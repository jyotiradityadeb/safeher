import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  return {
    store: new Map<string, string>(),
    apiGet: vi.fn(),
    apiPost: vi.fn(),
  };
});

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => mocked.store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mocked.store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mocked.store.delete(key);
  }),
}));

vi.mock("../api/client", () => ({
  api: {
    get: mocked.apiGet,
    post: mocked.apiPost,
  },
}));

import {
  processPendingCheckInEscalation,
  refreshPendingCheckInFromServer,
} from "./smartCheckInMonitor";

describe("smartCheckInMonitor", () => {
  beforeEach(() => {
    mocked.store.clear();
    mocked.apiGet.mockReset();
    mocked.apiPost.mockReset();
    mocked.store.set("safeher_token", "token-1");
  });

  it("stores latest pending check-in from server", async () => {
    const pending = {
      id: "check-1",
      reason: "post_alert",
      status: "pending",
      due_at: new Date(Date.now() + 10000).toISOString(),
    };
    mocked.apiGet.mockResolvedValueOnce({ data: pending });

    const result = await refreshPendingCheckInFromServer();

    expect(result?.id).toBe("check-1");
    expect(mocked.store.get("safeher_pending_checkin")).toContain("check-1");
  });

  it("escalates when stored pending check-in is overdue", async () => {
    mocked.store.set(
      "safeher_pending_checkin",
      JSON.stringify({
        id: "check-2",
        reason: "post_alert",
        status: "pending",
        due_at: new Date(Date.now() - 1000).toISOString(),
      })
    );
    mocked.apiPost.mockResolvedValue({ data: {} });

    const outcome = await processPendingCheckInEscalation();

    expect(outcome).toBe("escalated");
    expect(mocked.apiPost).toHaveBeenCalledTimes(2);
    expect(mocked.store.get("safeher_pending_checkin")).toBeUndefined();
  });
});
