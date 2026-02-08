import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { getNotifications, markNotificationRead } from "../services/notificationService";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";
import type { Notification } from "../types";

const NotificationsBell = () => {
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  const socket = useSocket(token);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const loadNotifications = async () => {
    try {
        const data = await getNotifications();
        setItems(data.notifications);
        setUnread(data.unreadCount);
    } catch (err) {
        console.error("Failed to load notifications", err);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    const handler = (notification: Notification) => {
      setItems((prev) => [notification, ...prev]);
      setUnread((prev) => prev + 1);
    };

    socket.on("notification", handler);
    return () => {
      socket.off("notification", handler);
    };
  }, [socket]);

  const handleRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
        await markNotificationRead(id);
        setItems((prev) =>
        prev.map((item) => (item._id === id ? { ...item, read: true } : item))
        );
        setUnread((prev) => Math.max(prev - 1, 0));
    } catch(err) {
        console.error("Failed to mark read", err);
    }
  };
  
  // Close on click outside (simplified)
  useEffect(() => {
      const close = () => setOpen(false);
      if (open) window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#050505]">
                {unread > 9 ? '9+' : unread}
            </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-xl bg-[#0f172a] border border-gray-800 shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#1e293b]/50">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                {unread > 0 && <span className="text-xs text-indigo-400 font-medium">{unread} unread</span>}
            </div>
          <div className="max-h-[400px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 space-y-2">
                  <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                  <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              items.map((item) => (
                <div 
                    key={item._id} 
                    className={`flex items-start gap-3 p-4 border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors ${!item.read ? "bg-indigo-500/5" : ""}`}
                >
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!item.read ? "bg-indigo-500" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300">
                           {item.type === 'message' && <span className="font-semibold text-white">New Message</span>}
                           {item.type === 'mention' && <span className="font-semibold text-indigo-400">Mentioned you</span>}
                           {item.type === 'invite_accepted' && <span className="font-semibold text-green-400">Invite Accepted</span>}
                           {!['message', 'mention', 'invite_accepted'].includes(item.type) && <span className="font-semibold capitalize text-white">{item.type}</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </p>
                    </div>
                  {!item.read && (
                    <button
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium whitespace-nowrap"
                      onClick={(e) => handleRead(e, item._id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
