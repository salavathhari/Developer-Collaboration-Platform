import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import EmailInput from "../components/EmailInput";
import PasswordInput from "../components/PasswordInput";
import { User, Loader2, CheckCircle } from "lucide-react";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error) {
          setErrors({ general: data.error });
        }
        return;
      }

      // Show success state
      setSuccess(true);

      // Redirect to verification pending page after 2 seconds
      setTimeout(() => {
        navigate("/verify-email-pending", { state: { email: formData.email } });
      }, 2000);
    } catch (error) {
      console.error("Registration error:", error);
      setErrors({ general: "An unexpected error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    formData.name.trim().length >= 2 &&
    formData.email.trim().length > 0 &&
    formData.password.length >= 8;

  if (success) {
    return (
      <AuthLayout
        title="Account Created!"
        subtitle="Check your inbox for a verification email"
      >
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="text-green-500" size={32} />
          </div>
          <p className="text-zinc-300">
            We've sent a verification link to{" "}
            <span className="font-medium text-white">{formData.email}</span>
          </p>
          <p className="text-sm text-zinc-400">Redirecting...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Get Started"
      subtitle="Create your account and start collaborating"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Error */}
        {errors.general && (
          <div
            className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm"
            role="alert"
          >
            {errors.general}
          </div>
        )}

        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
            Full Name
          </label>
          <div className="relative">
            <User
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="John Doe"
              required
              minLength={2}
              className="w-full pl-11 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              aria-label="Full name"
            />
          </div>
        </div>

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
            Email Address
          </label>
          <EmailInput
            value={formData.email}
            onChange={(value) => setFormData({ ...formData, email: value })}
            error={errors.email}
            required
          />
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
            Password
          </label>
          <PasswordInput
            value={formData.password}
            onChange={(value) =>
              setFormData({ ...formData, password: value })
            }
            error={errors.password}
            showStrengthMeter
            required
            autoComplete="new-password"
          />
        </div>

        {/* Terms & Privacy */}
        <div className="text-sm text-zinc-400">
          By creating an account, you agree to our{" "}
          <a href="/terms" className="text-purple-400 hover:text-purple-300">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-purple-400 hover:text-purple-300">
            Privacy Policy
          </a>
          .
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:shadow-none flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Creating Account...
            </>
          ) : (
            "Create Account"
          )}
        </button>

        {/* Login Link */}
        <div className="text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-purple-400 hover:text-purple-300 font-medium"
          >
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Register;
