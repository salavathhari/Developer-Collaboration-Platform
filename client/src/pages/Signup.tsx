import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) {
      return "Name is required.";
    }

    if (!isValidEmail(form.email)) {
      return "Enter a valid email address.";
    }

    if (form.password.length < 8) {
      return "Password must be at least 8 characters.";
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
      await signup(form);
      setSuccess("Account created. Redirecting to sign in...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError("Email already exists. Please sign in.");
      } else {
        const message = err?.response?.data?.message || "Signup failed.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>Create your workspace</h2>
        <p>Join the collaboration hub for developer teams.</p>
      </div>

      {success ? <div className="form-alert success">{success}</div> : null}
      {error ? <div className="form-alert error">{error}</div> : null}

      <label className="field">
        <span>Full name</span>
        <input
          className="input"
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Alex Rivera"
          autoComplete="name"
          required
        />
      </label>

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
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
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
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="form-footer">
        Already have an account? <Link to="/login">Sign in</Link>.
      </p>
    </form>
  );
};

export default Signup;
