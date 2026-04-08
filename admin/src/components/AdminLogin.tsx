import { FormEvent, useState } from "react";

import { api } from "../api/client";

type Props = {
  onAuthenticated: (token: string) => void;
};

export function AdminLogin({ onAuthenticated }: Props) {
  const [email, setEmail] = useState("admin@safeher.app");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (!data.user?.is_admin) {
        setError("This account does not have admin access.");
        return;
      }
      onAuthenticated(data.access_token);
    } catch (err) {
      setError("Login failed. Check the admin credentials.");
    }
  };

  return (
    <div className="layout">
      <div className="card" style={{ maxWidth: 420, margin: "10vh auto 0" }}>
        <h1>Admin Login</h1>
        <p className="muted">Sign in to view live alerts and model metrics.</p>
        <form onSubmit={handleSubmit}>
          <input
            aria-label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={inputStyle}
          />
          <input
            aria-label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
          />
          <button type="submit" style={buttonStyle}>
            Login
          </button>
        </form>
        {error ? <p style={{ color: "#fca5a5" }}>{error}</p> : null}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  background: "rgba(15, 23, 42, 0.85)",
  color: "#f8fafc",
  marginBottom: 12,
} as const;

const buttonStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "none",
  background: "#f97316",
  color: "#f8fafc",
  fontWeight: 700,
  cursor: "pointer",
} as const;
