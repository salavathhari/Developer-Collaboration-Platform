import { useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";

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
  const token = localStorage.getItem("token");
  const socket = useSocket(token);

  // ICE Configuration
  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  };

  const [peers, setPeers] = useState<PeerData[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<PeerData[]>([]);

  useEffect(() => {
    if (!socket || !user) return;

    const init = async () => {
        try {
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(localStream);
            if (userVideo.current) {
                userVideo.current.srcObject = localStream;
            }

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
                // Wait for their signal? Or if using the "Newcomer Initiates" logic:
                // If Newcomer Initiates, existing users DO NOTHING here except wait for signal.
                // However, updated logic:
                // Server emits "all_video_users" to newcomer -> Newcomer creates Initiator Peers.
                // Existing users receive "webrtc_signal" -> Create Non-Initiator Peers.
                
                // So "user_joined_video" is just for UI notifications or "Slot reservation".
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
                onClose();
            });

        } catch (err) {
            console.error("Error accessing media devices:", err);
            alert("Could not access camera/microphone.");
            onClose();
        }
    };

    init();

    return () => {
        // Cleanup
        socket.off("all_video_users");
        socket.off("user_joined_video");
        socket.off("user_left_video");
        socket.off("webrtc_signal");
        socket.off("video_status_update");
        socket.off("video_session_ended");
        socket.emit("leave_video_room", { projectId });

        // IMPORTANT: Stop tracks
        setStream(prevStream => {
            if (prevStream) {
                prevStream.getTracks().forEach(track => track.stop());
            }
            return null;
        });

        peersRef.current.forEach(p => p.peer.destroy());
        peersRef.current = [];
    };
  }, [socket, projectId, user]);

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

  return (
    <div className="flex flex-col h-full bg-gray-950">
        <div className="flex items-center justify-between p-2 bg-gray-900 border-b border-gray-800">
             <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                 Live ({peers.length + 1})
             </span>
             <button onClick={onClose} className="text-gray-400 hover:text-white">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
        </div>
        
        <div className="flex-1 p-2 grid grid-cols-2 gap-2 overflow-y-auto">
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                <video ref={userVideo} muted autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 px-1 rounded text-white">You</span>
            </div>
            {peers.map(p => (
                <div key={p.peerId} className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                    <VideoStream peer={p.peer} />
                </div>
            ))}
        </div>

        <div className="p-2 bg-gray-900 flex justify-center gap-4">
             <button onClick={toggleMute} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full">🎤</button>
             <button onClick={onClose} className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full px-4 text-xs font-bold">Leave</button>
        </div>
    </div>
  );
};

export default VideoCall;

