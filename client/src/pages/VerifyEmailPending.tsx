import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { Mail, Loader2, CheckCircle } from "lucide-react";

const VerifyEmailPending: React.FC = () => {
  const location = useLocation();
  const email = (location.state as any)?.email || "";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resendDisabled, setResendDisabled] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Verification email sent! Please check your inbox.");
        setResendDisabled(true);

        // Enable resend after 60 seconds
        setTimeout(() => {
          setResendDisabled(false);
        }, 60000);
      } else {
        setMessage(data.error || "Failed to resend email");
      }
    } catch (error) {
      console.error("Resend error:", error);
      setMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Check Your Email"
      subtitle="We've sent you a verification link"
    >
      <div className="text-center space-y-6">
        <div className="mx-auto w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center">
          <Mail className="text-purple-500" size={36} />
        </div>

        <div className="space-y-3">
          <p className="text-zinc-300">
            A verification link has been sent to:
          </p>
          <p className="text-white font-semibold text-lg">{email}</p>
          <p className="text-sm text-zinc-400">
            Click the link in the email to verify your account and start using
            DevCollab.
          </p>
        </div>

        {message && (
          <div
            className={`${
              message.includes("sent")
                ? "bg-green-500/10 border-green-500/50 text-green-400"
                : "bg-red-500/10 border-red-500/50 text-red-400"
            } border rounded-lg p-4 text-sm flex items-center justify-center gap-2`}
          >
            {message.includes("sent") && <CheckCircle size={16} />}
            {message}
          </div>
        )}

        <div className="pt-4 space-y-3">
          <button
            onClick={handleResend}
            disabled={loading || resendDisabled}
            className="w-full text-purple-400 hover:text-purple-300 disabled:text-zinc-600 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Sending...
              </>
            ) : resendDisabled ? (
              "Email sent! Wait 60s to resend"
            ) : (
              "Resend verification email"
            )}
          </button>

          <Link
            to="/login"
            className="block text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Back to Login
          </Link>
        </div>

        <div className="pt-6 border-t border-zinc-800 text-sm text-zinc-500">
          <p>Didn't receive the email?</p>
          <p className="mt-1">Check your spam folder or contact support</p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPending;
