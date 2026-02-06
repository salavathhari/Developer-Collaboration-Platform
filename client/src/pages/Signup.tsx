import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import api from "../lib/api";

const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

type SignupPayload = {
  name: string;
  email: string;
  password: string;
};

type SignupProps = {
  onSuccess: () => void;
};

const Signup = ({ onSuccess }: SignupProps) => {
  const [form, setForm] = useState<SignupPayload>({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/api/auth/register", form);
      const { token } = response.data;

      if (token) {
        localStorage.setItem("token", token);
        onSuccess();
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || "Signup failed.";
      setError(message);
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
        <input
          className="input"
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          required
        />
      </label>

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="form-footer">
        By creating an account you agree to our terms and privacy policy.
      </p>
    </form>
  );
};

export default Signup;
