import { api } from "../api/client";

export async function fetchLatestGlobalModel() {
  const { data } = await api.get("/federated/model/latest/public");
  return data;
}

export async function simulateFederatedRound() {
  const { data } = await api.post("/federated/device-round", {});
  return data;
}
