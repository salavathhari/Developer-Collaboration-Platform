import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import api from "../lib/api";

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

type LoginPayload = {
  email: string;
  password: string;
};

type LoginProps = {
  onSuccess: () => void;
};

const Login = ({ onSuccess }: LoginProps) => {
  const [form, setForm] = useState<LoginPayload>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/api/auth/login", form);
      const { token } = response.data;

      if (token) {
        localStorage.setItem("token", token);
        onSuccess();
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || "Login failed.";
      setError(message);
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
        <input
          className="input"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </label>

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <p className="form-footer">
        Use the email you registered with. We never share your data.
      </p>
    </form>
  );
};

export default Login;
