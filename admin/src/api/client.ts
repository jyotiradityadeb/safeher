import axios from "axios";

export const api = axios.create({
  // Use local proxy by default for more reliable dev networking.
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

export const setAdminToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
