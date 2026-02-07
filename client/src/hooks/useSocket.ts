import { useEffect, useMemo } from "react";
import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;
let socketToken: string | null = null;

const getSocketUrl = () => {
  return import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
};

export const useSocket = (token: string | null) => {
  const socket = useMemo(() => {
    if (!token) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        socketToken = null;
      }
      return null;
    }

    if (socketInstance && socketToken === token) {
      return socketInstance;
    }

    if (socketInstance && socketToken !== token) {
      socketInstance.disconnect();
    }

    socketInstance = io(getSocketUrl(), {
      auth: { token },
      transports: ["websocket"],
    });
    socketToken = token;
    return socketInstance;
  }, [token]);

  useEffect(() => {
    return () => {
      // Keep singleton alive for other subscribers.
    };
  }, [socket]);

  return socket as Socket | null;
};
