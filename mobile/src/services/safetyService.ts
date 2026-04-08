import { api } from "../api/client";

export type LiveRoomParticipant = {
  name: string;
  phone_number?: string;
  relationship?: string;
  channel?: string;
};

export type LiveRoomTimelineEntry = {
  type: string;
  message: string;
  created_at: string;
};

export type LiveRoom = {
  id: string;
  room_code: string;
  status: string;
  participants: LiveRoomParticipant[];
  timeline: LiveRoomTimelineEntry[];
  updated_at: string;
};

export type SmartCheckIn = {
  id: string;
  reason: string;
  status: "pending" | "safe" | "need_help" | "missed";
  requested_at: string;
  due_at: string;
  acknowledged_at?: string | null;
  note?: string | null;
};

export async function getLatestLiveRoom(): Promise<LiveRoom | null> {
  const { data } = await api.get("/safety/live-room/latest");
  return data ?? null;
}

export async function addLiveRoomNote(roomId: string, message: string): Promise<LiveRoom> {
  const { data } = await api.post(`/safety/live-room/${roomId}/notes`, { message });
  return data;
}

export async function requestSmartCheckIn(reason: string, dueInSeconds = 120): Promise<SmartCheckIn> {
  const { data } = await api.post("/safety/check-ins/request", {
    reason,
    due_in_seconds: dueInSeconds,
  });
  return data;
}

export async function getLatestSmartCheckIn(): Promise<SmartCheckIn | null> {
  const { data } = await api.get("/safety/check-ins/latest");
  return data ?? null;
}

export async function acknowledgeSmartCheckIn(
  checkInId: string,
  status: "safe" | "need_help",
  note?: string
): Promise<SmartCheckIn> {
  const { data } = await api.post(`/safety/check-ins/${checkInId}/ack`, {
    status,
    note,
  });
  return data;
}
