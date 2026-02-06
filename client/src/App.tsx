import { useState } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import "./App.css";

type Mode = "login" | "signup";

function App() {
  const [mode, setMode] = useState<Mode>("login");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSuccess = () => {
    setStatusMessage("Success. Token stored in localStorage.");
  };

  return (
    <div className="auth-shell">
      <div className="brand-panel">
        <div className="brand-chip">DevCollab</div>
        <h1>Build together. Ship faster.</h1>
        <p>
          A focused workspace for modern engineering teams, pairing code, design,
          and releases into one flow.
        </p>
        <div className="brand-stats">
          <div>
            <span>99.98%</span>
            <small>service uptime</small>
          </div>
          <div>
            <span>24/7</span>
            <small>collaboration</small>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            type="button"
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            type="button"
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>

        {statusMessage ? (
          <div className="form-alert success">{statusMessage}</div>
        ) : null}

        {mode === "login" ? (
          <Login onSuccess={handleSuccess} />
        ) : (
          <Signup onSuccess={handleSuccess} />
        )}
      </div>
    </div>
  );
}

export default App;
