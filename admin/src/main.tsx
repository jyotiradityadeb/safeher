import React from "react";
import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";

import { api, setAdminToken } from "./api/client";
import { AdminLogin } from "./components/AdminLogin";
import { Dashboard } from "./pages/Dashboard";
import "./theme/styles.css";

function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem("safeher_admin_token"));
  const [checking, setChecking] = useState(Boolean(token));

  const handleAuthenticated = (nextToken: string) => {
    window.localStorage.setItem("safeher_admin_token", nextToken);
    setAdminToken(nextToken);
    setToken(nextToken);
    setChecking(false);
  };

  useEffect(() => {
    let active = true;

    const verifySession = async () => {
      if (!token) {
        setChecking(false);
        return;
      }

      setAdminToken(token);
      try {
        const { data } = await api.get("/me");
        if (!data?.is_admin) {
          throw new Error("Admin access required.");
        }
        if (active) {
          setChecking(false);
        }
      } catch {
        window.localStorage.removeItem("safeher_admin_token");
        setAdminToken(undefined);
        if (active) {
          setToken(null);
          setChecking(false);
        }
      }
    };

    verifySession();
    return () => {
      active = false;
    };
  }, [token]);

  if (!token) {
    return <AdminLogin onAuthenticated={handleAuthenticated} />;
  }

  return (
    <Dashboard
      onLogout={() => {
        window.localStorage.removeItem("safeher_admin_token");
        setAdminToken(undefined);
        setToken(null);
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
