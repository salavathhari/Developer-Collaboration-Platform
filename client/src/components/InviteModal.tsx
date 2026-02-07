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
      await inviteMember(project._id || project.id, email.trim());
      setStatus("Invite email sent successfully!");
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
      // @ts-ignore
      const response = await createInviteLink(project._id || project.id);
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
    setStatus("Invite link copied to clipboard.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-8 w-full max-w-lg shadow-2xl relative">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold font-mono text-white">Invite Members</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <p className="text-sm text-gray-500 font-mono mb-6">Project: {project.name}</p>

        {status && (
            <div className={`mb-4 px-4 py-3 rounded-lg border font-mono text-sm ${
                status.includes('sent') || status.includes('copied') ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
            }`}>
                {status}
            </div>
        )}
        
        {error && (
            <div className="mb-4 px-4 py-3 rounded-lg border bg-red-500/10 border-red-500/20 text-red-400 font-mono text-sm">
                {error}
            </div>
        )}

        <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2 font-mono">Invite by email</label>
              <div className="flex gap-2">
                  <input
                    className="flex-1 bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="teammate@example.com"
                  />
                  <button
                    className="bg-[#6366f1] hover:bg-[#5558e0] disabled:bg-indigo-500/50 disabled:cursor-not-allowed text-white px-6 rounded-lg font-bold text-sm transition-colors font-mono"
                    type="button"
                    disabled={loading}
                    onClick={handleInviteByEmail}
                  >
                    {loading ? 'Sending...' : 'Send'}
                  </button>
              </div>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-800"></div>
                </div>
                <div className="relative flex justify-center">
                    <span className="px-2 bg-[#0b0c10] text-sm text-gray-500 font-mono">or share a link</span>
                </div>
            </div>

            <div>
              {!inviteLink ? (
                  <button
                    className="w-full py-3 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg font-medium text-sm transition-colors font-mono flex items-center justify-center gap-2"
                    type="button"
                    disabled={loading}
                    onClick={handleGenerateLink}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    Generate Invite Link
                  </button>
              ) : (
                  <div className="flex gap-2">
                    <input 
                        className="flex-1 bg-[#161b22] border border-gray-800 rounded-lg px-4 py-3 text-gray-400 font-mono text-xs select-all outline-none" 
                        readOnly 
                        value={inviteLink} 
                    />
                    <button
                      className="bg-[#1f2937] hover:bg-[#374151] text-white px-6 rounded-lg font-bold text-sm transition-colors font-mono border border-gray-700"
                      type="button"
                      onClick={handleCopy}
                    >
                      Copy
                    </button>
                  </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
