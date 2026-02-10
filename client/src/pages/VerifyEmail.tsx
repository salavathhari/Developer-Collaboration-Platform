import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing");
      return;
    }

    // Call API to verify email
    fetch(`/api/auth/verify?token=${token}`)
      .then((res) => {
        if (res.redirected) {
          // Server redirected us (successful verification)
          window.location.href = res.url;
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.error) {
          setStatus("error");
          setMessage(data.error);
        } else {
          setStatus("success");
          setMessage("Email verified successfully!");
          setTimeout(() => {
            navigate("/login?verified=1");
          }, 2000);
        }
      })
      .catch((error) => {
        console.error("Verification error:", error);
        setStatus("error");
        setMessage("Failed to verify email. Please try again.");
      });
  }, [searchParams, navigate]);

  return (
    <AuthLayout title="Email Verification" subtitle="">
      <div className="text-center space-y-6">
        {status === "verifying" && (
          <>
            <div className="mx-auto w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Loader2 className="text-purple-500 animate-spin" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Verifying your email...
              </h3>
              <p className="text-zinc-400">Please wait a moment</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-500" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Email Verified!
              </h3>
              <p className="text-zinc-400">{message}</p>
              <p className="text-sm text-zinc-500 mt-4">
                Redirecting to login...
              </p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
              <XCircle className="text-red-500" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Verification Failed
              </h3>
              <p className="text-zinc-400">{message}</p>
            </div>
            <button
              onClick={() => navigate("/login")}
              className="mt-4 text-purple-400 hover:text-purple-300 font-medium"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;
