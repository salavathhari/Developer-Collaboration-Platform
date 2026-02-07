import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { acceptInvite } from "../services/projectService";

const InviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Accepting invite...");

  useEffect(() => {
    const handleAccept = async () => {
      try {
        if (!token) {
          setStatus("Invite token missing.");
          return;
        }

        await acceptInvite(token);
        setStatus("Invite accepted. Redirecting to dashboard...");
        setTimeout(() => navigate("/dashboard"), 1500);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          localStorage.setItem("pendingInviteToken", token || "");
          setStatus("Please sign in to accept this invite.");
          setTimeout(() => navigate("/login"), 1200);
          return;
        }

        setStatus(err?.response?.data?.message || "Invite is invalid or expired.");
      }
    };

    handleAccept();
  }, [navigate, token]);

  return (
    <div className="invite-accept">
      <h2>{status}</h2>
      <p>If you are not logged in, sign in and open the invite link again.</p>
    </div>
  );
};

export default InviteAccept;
