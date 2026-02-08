import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import VideoCall from "../components/VideoCall";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";
import axios from "axios";

interface VideoContextType {
  activeCall: { projectId: string; meetingId?: string } | null;
  startCall: (projectId: string, type?: string, referenceId?: string) => Promise<void>;
  joinCall: (projectId: string) => void;
  leaveCall: () => void;
  activeProjectCalls: Record<string, boolean>; // projectId -> hasActiveCall
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export const VideoProvider = ({ children }: { children: ReactNode }) => {
  const [activeCall, setActiveCall] = useState<{ projectId: string; meetingId?: string } | null>(null);
  const [activeProjectCalls, setActiveProjectCalls] = useState<Record<string, boolean>>({});
  
  const token = localStorage.getItem("token");
  const socket = useSocket(token);
  const { user } = useAuth(); // Assuming useAuth exists and provides user info

  useEffect(() => {
    if (!socket) return;

    // Listen for video status updates for projects we are interested in.
    // In a real app, we might need to subscribe to these updates. 
    // For now, we rely on broadcast or assume we're joined to project rooms.
    
    socket.on("video_status_update", ({ projectId, active }: { projectId: string; active: boolean }) => {
        setActiveProjectCalls(prev => ({
            ...prev,
            [projectId]: active
        }));
    });

    return () => {
        socket.off("video_status_update");
    };
  }, [socket]);

  const startCall = async (projectId: string, type: string = 'project', referenceId: string = '') => {
    try {
        // Create meeting record
        const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/meetings`, {
            projectId,
            type,
            referenceId,
            title: `Call started by ${user?.name || 'User'}`
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const meetingId = res.data._id;
        setActiveCall({ projectId, meetingId });
    } catch (err) {
        console.error("Failed to start call", err);
        // Fallback if API fails? Or just join via socket directly?
        setActiveCall({ projectId });
    }
  };

  const joinCall = (projectId: string) => {
    setActiveCall({ projectId });
  };

  const leaveCall = () => {
    setActiveCall(null);
  };

  return (
    <VideoContext.Provider value={{ activeCall, startCall, joinCall, leaveCall, activeProjectCalls }}>
      {children}
      {activeCall && (
        <div className="fixed bottom-4 right-4 w-96 h-64 z-50 shadow-2xl rounded-xl overflow-hidden border border-gray-700 bg-gray-900 resize-y min-h-[16rem]">
             <VideoCall projectId={activeCall.projectId} onClose={leaveCall} />
        </div>
      )}
    </VideoContext.Provider>
  );
};

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error("useVideo must be used within a VideoProvider");
  }
  return context;
};
