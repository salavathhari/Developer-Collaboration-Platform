import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { acceptInvite } from "../services/projectService";

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!isValidEmail(form.email)) {
      return "Enter a valid email address.";
    }

    if (!form.password) {
      return "Password is required.";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      await login(form);

      const pendingInvite = localStorage.getItem("pendingInviteToken");
      if (pendingInvite) {
        try {
          await acceptInvite(pendingInvite);
          localStorage.removeItem("pendingInviteToken");
        } catch {
          localStorage.removeItem("pendingInviteToken");
        }
      }

      setSuccess("Signed in. Redirecting...");
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError("Invalid email or password.");
      } else {
        const message = err?.response?.data?.message || "Login failed.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>Welcome back</h2>
        <p>Sign in to keep building with your team.</p>
      </div>

      {success ? <div className="form-alert success">{success}</div> : null}
      {error ? <div className="form-alert error">{error}</div> : null}

      <label className="field">
        <span>Email</span>
        <input
          className="input"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@studio.dev"
          autoComplete="email"
          required
        />
      </label>

      <label className="field">
        <span>Password</span>
        <div className="input-row">
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <button
            className="ghost-button"
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <p className="form-footer">
        Need an account? <Link to="/signup">Create one</Link>.
      </p>
    </form>
  );
};

export default Login;
