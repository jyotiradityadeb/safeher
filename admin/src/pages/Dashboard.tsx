import { useEffect, useState } from "react";

import { api } from "../api/client";

type Summary = {
  total_alerts: number;
  active_alerts: number;
  avg_confidence: number;
  recent_alerts: any[];
};

type DashboardProps = {
  onLogout?: () => void;
};

export function Dashboard({ onLogout }: DashboardProps) {
  const [summary, setSummary] = useState<Summary>({
    total_alerts: 0,
    active_alerts: 0,
    avg_confidence: 0,
    recent_alerts: [],
  });
  const [model, setModel] = useState<any>({ round_id: 0, metrics: {}, aggregated_weights: [] });
  const [actionMessage, setActionMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const applyIncomingAlert = (alert: any) => {
    setSummary((current) => ({
      ...current,
      total_alerts: current.total_alerts + 1,
      active_alerts: current.active_alerts + 1,
      recent_alerts: [alert, ...current.recent_alerts].slice(0, 20),
      avg_confidence:
        current.total_alerts === 0
          ? Number(alert.confidence || 0)
          : Number(
              (
                (current.avg_confidence * current.total_alerts + Number(alert.confidence || 0)) /
                (current.total_alerts + 1)
              ).toFixed(3)
            ),
    }));
  };

  const loadData = async () => {
    try {
      setLoadError("");
      const [summaryResponse, modelResponse] = await Promise.all([
        api.get("/admin/summary"),
        api.get("/federated/model/latest"),
      ]);
      setSummary(summaryResponse.data);
      setModel(modelResponse.data);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || "Could not refresh dashboard data.";
      setLoadError(detail);
    }
  };

  useEffect(() => {
    loadData();
    const poller = window.setInterval(loadData, 4000);
    return () => window.clearInterval(poller);
  }, []);

  useEffect(() => {
    const wsFallback = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/alerts`;
    const wsUrl = import.meta.env.VITE_WS_URL || wsFallback;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let heartbeat: number | null = null;

    const connect = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (reconnectTimer) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "alert.created") {
          applyIncomingAlert(message.payload);
        }
      };

      socket.onclose = () => {
        reconnectTimer = window.setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();
    heartbeat = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send("ping");
      }
    }, 15000);

    return () => {
      if (heartbeat) {
        window.clearInterval(heartbeat);
      }
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, []);

  const triggerDemoAlert = async () => {
    try {
      const { data } = await api.post("/demo/trigger-alert", {});
      setActionMessage(data.message);
      if (data.alert) {
        applyIncomingAlert(data.alert);
      } else {
        loadData();
      }
    } catch (error: any) {
      setLoadError(error?.response?.data?.detail || error?.message || "Could not trigger demo alert.");
    }
  };

  const seedDemoModel = async () => {
    const { data } = await api.post("/demo/seed-model", {});
    setActionMessage(data.message);
    loadData();
  };

  return (
    <div className="layout">
      <h1>SafeHer Admin Dashboard</h1>
      <p className="muted">Monitor alerts, user safety events, and federated learning performance.</p>
      {onLogout ? (
        <div style={{ marginBottom: 12 }}>
          <button style={logoutButton} onClick={onLogout}>Logout</button>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button style={actionButton} onClick={triggerDemoAlert}>Trigger Demo Alert</button>
        <button style={actionButtonSecondary} onClick={seedDemoModel}>Seed Demo Model</button>
        <button style={actionButtonSecondary} onClick={loadData}>Refresh Dashboard</button>
      </div>
      {actionMessage ? <p className="muted">{actionMessage}</p> : null}
      {loadError ? <p className="muted" style={{ color: "#fca5a5" }}>{loadError}</p> : null}
      <div className="grid">
        <div className="card">
          <div className="muted">Total Alerts</div>
          <div className="metric">{summary.total_alerts}</div>
        </div>
        <div className="card">
          <div className="muted">Active Alerts</div>
          <div className="metric">{summary.active_alerts}</div>
        </div>
        <div className="card">
          <div className="muted">Average Confidence</div>
          <div className="metric">{summary.avg_confidence}</div>
        </div>
        <div className="card">
          <div className="muted">Federated Round</div>
          <div className="metric">{model.round_id}</div>
        </div>
      </div>
      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Recent Alerts</h2>
          {summary.recent_alerts.map((alert) => (
            <div className="alert" key={alert.id}>
              <strong>{alert.gesture_label}</strong>
              <div className="muted">User: {alert.user_name || alert.user_email || alert.user_id}</div>
              <div className="muted">Confidence: {alert.confidence}</div>
              <div className="muted">Map: {alert.map_link}</div>
              <div className="muted">Channels: {(alert.delivery_channels || []).join(", ") || "none"}</div>
              <div className="muted">Delivery: {(alert.delivery_results || []).map((item: any) => `${item.contact}:${item.status}`).join(", ") || "pending"}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Model Metrics</h2>
          <pre>{JSON.stringify(model.metrics, null, 2)}</pre>
          <h3>Weights Preview</h3>
          <pre>{JSON.stringify(model.aggregated_weights.slice(0, 10), null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

const actionButton = {
  padding: "12px 16px",
  borderRadius: "12px",
  border: "none",
  background: "#ef4444",
  color: "#f8fafc",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const actionButtonSecondary = {
  padding: "12px 16px",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  background: "rgba(15, 23, 42, 0.85)",
  color: "#f8fafc",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const logoutButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  background: "transparent",
  color: "#f8fafc",
  fontWeight: 700,
  cursor: "pointer",
} as const;
