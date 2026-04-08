import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { Dashboard } from "./Dashboard";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    get: vi.fn(),
  },
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 1;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send() {}

  close() {}
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/admin/summary") {
        return Promise.resolve({
          data: {
            total_alerts: 1,
            active_alerts: 1,
            avg_confidence: 0.91,
            recent_alerts: [
              {
                id: "alert-1",
                gesture_label: "distress_swipe",
                user_id: "user-1",
                confidence: 0.91,
                map_link: "https://maps.google.com/?q=1,2",
                delivery_results: [{ status: "sent" }],
              },
            ],
          },
        });
      }

      return Promise.resolve({
        data: {
          round_id: 3,
          metrics: { accuracy: 0.94 },
          aggregated_weights: [0.1, 0.2, 0.3],
        },
      });
    });
  });

  afterEach(() => {
    cleanup();
    MockWebSocket.instances = [];
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders summary data", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("SafeHer Admin Dashboard")).toBeInTheDocument();
      expect(screen.getAllByText("1")).toHaveLength(2);
      expect(screen.getByText("distress_swipe")).toBeInTheDocument();
      expect(screen.getAllByText(/0.91/)).toHaveLength(2);
    });
  });

  it("updates when a realtime alert arrives", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({
        type: "alert.created",
        payload: {
          id: "alert-2",
          gesture_label: "panic_circle",
          user_id: "user-2",
          confidence: 0.96,
          map_link: "https://maps.google.com/?q=3,4",
          delivery_results: [{ status: "simulated" }],
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText("panic_circle")).toBeInTheDocument();
      expect(screen.getByText(/simulated/)).toBeInTheDocument();
    });
  });
});
