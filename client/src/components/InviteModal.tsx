import { useEffect, useState } from "react";

import { createInviteLink, inviteMember } from "../services/projectService";
import type { Project } from "../types";

type InviteModalProps = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
};

const InviteModal = ({ open, project, onClose }: InviteModalProps) => {
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setInviteLink(null);
      setStatus(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open || !project) {
    return null;
  }

  const handleInviteByEmail = async () => {
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStatus(null);
      const response = await inviteMember(project._id, email.trim());
      setInviteLink(response.inviteLink);
      setStatus("Invite sent. Share the link below.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to send invite.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    try {
      setLoading(true);
      setError(null);
      setStatus(null);
      const response = await createInviteLink(project._id);
      setInviteLink(response.inviteLink);
      setStatus("Invite link created.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create invite link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) {
      return;
    }
    await navigator.clipboard.writeText(inviteLink);
    setStatus("Invite link copied.");
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Invite members</h3>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="modal-subtitle">Project: {project.name}</p>

        {status ? <div className="form-alert success">{status}</div> : null}
        {error ? <div className="form-alert error">{error}</div> : null}

        <div className="field">
          <span>Invite by email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@studio.dev"
          />
          <button
            className="primary-button"
            type="button"
            disabled={loading}
            onClick={handleInviteByEmail}
          >
            Send invite
          </button>
        </div>

        <div className="divider" />

        <div className="field">
          <span>Shareable link</span>
          <button
            className="secondary-button light"
            type="button"
            disabled={loading}
            onClick={handleGenerateLink}
          >
            Generate link
          </button>
        </div>

        {inviteLink ? (
          <div className="invite-link">
            <input className="input" readOnly value={inviteLink} />
            <button
              className="secondary-button light"
              type="button"
              onClick={handleCopy}
            >
              Copy
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default InviteModal;
