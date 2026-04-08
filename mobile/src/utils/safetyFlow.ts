export type PendingAlertState = {
  remainingSeconds: number;
  canceled: boolean;
  shouldSend: boolean;
};

export function tickPendingAlert(state: PendingAlertState): PendingAlertState {
  if (state.canceled || state.shouldSend) {
    return state;
  }
  const remaining = Math.max(state.remainingSeconds - 1, 0);
  return {
    remainingSeconds: remaining,
    canceled: false,
    shouldSend: remaining === 0,
  };
}

export function cancelPendingAlertState(state: PendingAlertState): PendingAlertState {
  return {
    ...state,
    canceled: true,
    shouldSend: false,
  };
}

export function resolveSmartCheckInStatus(
  status: "pending" | "safe" | "need_help" | "missed",
  dueAtIso: string,
  nowMs: number
) {
  if (status !== "pending") {
    return status;
  }
  return new Date(dueAtIso).getTime() <= nowMs ? "missed" : "pending";
}

export function buildPostAlertActionNote(
  action: "safe_now" | "need_help" | "share_update",
  at: Date
) {
  const time = at.toLocaleTimeString();
  if (action === "safe_now") {
    return "Safety update: user confirmed safe.";
  }
  if (action === "need_help") {
    return "Safety update: user requested immediate assistance.";
  }
  return `Status update: user checked in at ${time}.`;
}
