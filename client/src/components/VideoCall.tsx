import { useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";
import { useVideo } from "../context/VideoContext";

interface VideoCallProps {
  projectId: string;
  onClose: () => void;
}

interface PeerData {
  peerId: string;
  peer: SimplePeer.Instance;
  stream?: MediaStream;
}

const VideoStream = ({ peer }: { peer: SimplePeer.Instance }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    peer.on("stream", (stream) => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
  }, [peer]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="w-full h-full object-cover bg-black"
    />
  );
};

const VideoCall = ({ projectId, onClose }: VideoCallProps) => {
  const { user } = useAuth();
  const { leaveCall } = useVideo();
  // Ensure we get token safely, similar to VideoContext fix
  const token = user ? localStorage.getItem("token") : null;
  const socket = useSocket(token);

  // Call State
  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Media & Peers
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<PeerData[]>([]);

  // ICE Configuration
  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  };

  useEffect(() => {
    // ONLY run if callActive is true
    if (!callActive || !socket || !user) return;

    const init = async () => {
        try {
            setError(null);
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(localStream);
            
            if (userVideo.current) {
                userVideo.current.srcObject = localStream;
            }

            // Join the socket room specifically for video
            socket.emit("join_video_room", { projectId });

            socket.on("all_video_users", (users: string[]) => {
                const newPeers: PeerData[] = [];
                users.forEach((userID) => {
                    const peer = createPeer(userID, user.id, localStream);
                    newPeers.push({ peerId: userID, peer });
                });
                setPeers(prev => [...prev, ...newPeers]);
                peersRef.current = [...peersRef.current, ...newPeers];
            });

            socket.on("user_joined_video", ({ userId }: { userId: string }) => {
                console.log("User joined video:", userId);
            });

            socket.on("webrtc_signal", ({ senderId, signal }) => {
                const item = peersRef.current.find((p) => p.peerId === senderId);
                if (item) {
                    item.peer.signal(signal);
                } else {
                    const peer = addPeer(signal, senderId, localStream);
                    const peerObj = { peerId: senderId, peer };
                    peersRef.current.push(peerObj);
                    setPeers(prev => [...prev, peerObj]);
                }
            });

            socket.on("user_left_video", ({ userId }) => {
                const peerObj = peersRef.current.find((p) => p.peerId === userId);
                if (peerObj) peerObj.peer.destroy();
                const filtered = peersRef.current.filter((p) => p.peerId !== userId);
                peersRef.current = filtered;
                setPeers(filtered);
            });

            socket.on("video_status_update", ({ count }) => setActiveUsersCount(count));
            
            socket.on("video_session_ended", () => {
                alert("Session ended by host");
                handleLeaveCall();
            });

        } catch (err: any) {
            console.error("Error accessing media devices:", err);
            setError("Could not access camera/microphone. Please check permissions.");
            setCallActive(false); // Reset state
        }
    };

    init();

    return () => {
        // Cleanup function for when active becomes false OR component unmounts
        cleanupMedia();
    };
  }, [callActive, socket, projectId, user]);

  const cleanupMedia = () => {
     if (socket) {
        socket.off("all_video_users");
        socket.off("user_joined_video");
        socket.off("user_left_video");
        socket.off("webrtc_signal");
        socket.off("video_status_update");
        socket.off("video_session_ended");
        socket.emit("leave_video_room", { projectId });
     }

     if (peersRef.current) {
        peersRef.current.forEach(p => p.peer.destroy());
        peersRef.current = [];
        setPeers([]);
     }

     setStream(prevStream => {
        if (prevStream) { // Only stop tracks if we have them
            prevStream.getTracks().forEach(track => track.stop());
        }
        return null;
     });
  };

  const handleLeaveCall = () => {
      setCallActive(false);
      leaveCall(); // Use VideoContext's leaveCall
      if (onClose) onClose();
  };

  function createPeer(userToSignal: string, callerID: string, stream: MediaStream) {
    const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream,
        config: rtcConfig
    });

    peer.on("signal", signal => {
        socket?.emit("webrtc_signal", { targetId: userToSignal, signal });
    });

    return peer;
  }

  function addPeer(incomingSignal: SimplePeer.SignalData, callerID: string, stream: MediaStream) {
    const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream,
        config: rtcConfig
    });

    peer.on("signal", signal => {
        socket?.emit("webrtc_signal", { targetId: callerID, signal });
    });

    peer.signal(incomingSignal);

    return peer;
  }

  const toggleMute = () => {
      if(stream) {
          stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      }
  };

  // --------------------------------------------------
  // RENDER: LOBBY STATE (No Video yet)
  // --------------------------------------------------
  if (!callActive) {
      return (
        <div className="flex flex-col h-full bg-gray-950 items-center justify-center p-6 text-center">
            <div className="mb-6 p-4 bg-gray-900 rounded-full">
                <svg className="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">Ready to join?</h3>
            <p className="text-gray-400 mb-6 text-sm max-w-xs">
                Connect with your team in real-time. Camera and microphone will be enabled.
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded text-red-200 text-xs">
                    {error}
                </div>
            )}

            <div className="flex gap-3">
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                )}
                <button 
                    onClick={() => setCallActive(true)}
                    className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium text-sm shadow-lg shadow-blue-900/20"
                >
                    Start Video Session
                </button>
            </div>
        </div>
      );
  }

  // --------------------------------------------------
  // RENDER: ACTIVE CALL
  // --------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-gray-950">
        <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-800">
             <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                     Live ({peers.length + 1})
                 </span>
             </div>
             <button onClick={handleLeaveCall} className="text-gray-400 hover:text-white p-1 hover:bg-gray-800 rounded">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
        </div>
        
        <div className="flex-1 p-2 grid grid-cols-2 gap-2 overflow-y-auto content-start">
            {/* Self View */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video ring-1 ring-gray-800">
                <video ref={userVideo} muted autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                <span className="absolute bottom-1 right-2 text-[10px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">You</span>
            </div>
            
            {/* Peers View */}
            {peers.map(p => (
                <div key={p.peerId} className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video ring-1 ring-gray-800">
                    <VideoStream peer={p.peer} />
                    <span className="absolute bottom-1 right-2 text-[10px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">User {p.peerId.slice(0, 4)}</span>
                </div>
            ))}
        </div>

        <div className="p-3 bg-gray-900 border-t border-gray-800 flex justify-center gap-4">
             <button 
                onClick={toggleMute} 
                className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-full transition-all active:scale-95"
                title="Toggle Mute"
             >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                 </svg>
             </button>
             <button 
                onClick={handleLeaveCall} 
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-bold shadow-lg shadow-red-900/30 transition-all active:scale-95 flex items-center gap-2"
             >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6" />
                </svg>
                End Call
             </button>
        </div>
    </div>
  );
};

export default VideoCall;

