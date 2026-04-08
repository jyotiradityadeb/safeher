import { describe, expect, it } from "vitest";

import {
  buildPostAlertActionNote,
  cancelPendingAlertState,
  resolveSmartCheckInStatus,
  tickPendingAlert,
} from "./safetyFlow";

describe("safetyFlow pending alert transitions", () => {
  it("sends when countdown reaches zero", () => {
    const afterOne = tickPendingAlert({
      remainingSeconds: 1,
      canceled: false,
      shouldSend: false,
    });
    expect(afterOne.remainingSeconds).toBe(0);
    expect(afterOne.shouldSend).toBe(true);
  });

  it("stays canceled after cancellation", () => {
    const canceled = cancelPendingAlertState({
      remainingSeconds: 3,
      canceled: false,
      shouldSend: false,
    });
    const ticked = tickPendingAlert(canceled);
    expect(ticked.canceled).toBe(true);
    expect(ticked.shouldSend).toBe(false);
  });
});

describe("safetyFlow smart check-in transitions", () => {
  it("marks pending as missed after due time", () => {
    const status = resolveSmartCheckInStatus(
      "pending",
      new Date(Date.now() - 2000).toISOString(),
      Date.now()
    );
    expect(status).toBe("missed");
  });

  it("keeps safe status unchanged", () => {
    const status = resolveSmartCheckInStatus(
      "safe",
      new Date(Date.now() - 2000).toISOString(),
      Date.now()
    );
    expect(status).toBe("safe");
  });
});

describe("safetyFlow post-alert notes", () => {
  it("builds share-update notes", () => {
    const note = buildPostAlertActionNote("share_update", new Date("2026-04-03T12:00:00Z"));
    expect(note).toContain("Status update");
  });
});
