import { useEffect, useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { 
  getNotifications, 
  markNotificationRead, 
  markAllNotificationsRead 
} from "../services/notificationService";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";
import type { Notification } from "../types";

const NotificationsBell = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const socket = useSocket(token);
    
    // State
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    
    // Refs
    const bellRef = useRef<HTMLDivElement>(null);

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await getNotifications();
            setItems(data.notifications);
            setUnread(data.unreadCount);
        } catch (err) {
            console.error("Failed to load notifications", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) loadNotifications();
    }, [user]);

    useEffect(() => {
        if (!socket) return;
        const handler = (notification: Notification) => {
            // Play faint sound
            const audio = new Audio("/notification.mp3");
            audio.volume = 0.2;
            audio.play().catch(() => {}); // catch audio policy errors

            setItems((prev) => [notification, ...prev]);
            setUnread((prev) => prev + 1);
        };
        socket.on("notification", handler);
        return () => { socket.off("notification", handler); };
    }, [socket]);

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            setItems(prev => prev.map(n => ({...n, read: true})));
            setUnread(0);
        } catch (err) {
            console.error(err);
        }
    };

    const handleItemClick = async (notif: Notification) => {
        if (!notif.read) {
           markNotificationRead(notif._id).catch(console.error);
           setItems(prev => prev.map(n => n === notif ? {...n, read: true} : n));
           setUnread(Math.max(0, unread - 1));
        }

        // Action routing logic
        setOpen(false);
        if (notif.projectId) {
            // If it's related to code/PR
            if (notif.type.includes("pr") && notif.referenceId) {
                navigate(`/project/${notif.projectId}?tab=prs&prId=${notif.referenceId}`);
            } 
            // If it's a message/video
            else if (notif.type === "message" || notif.type === "video_call") {
                navigate(`/project/${notif.projectId}?tab=chat`);
            }
            // If it's task
            else if (notif.type.includes("task")) {
                navigate(`/project/${notif.projectId}?tab=tasks`);
            }
            // General project
            else {
                navigate(`/project/${notif.projectId}`);
            }
        }
    };

    const getIcon = (type: string) => {
        if (type.includes("pr")) return (
            <span className="p-1.5 rounded-full bg-purple-500/10 text-purple-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </span>
        );
        if (type.includes("task")) return (
            <span className="p-1.5 rounded-full bg-blue-500/10 text-blue-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </span>
        );
        if (type.includes("message") || type.includes("mention")) return (
             <span className="p-1.5 rounded-full bg-green-500/10 text-green-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </span>
        );
        return (
             <span className="p-1.5 rounded-full bg-gray-500/10 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
             </span>
        );
    };

    return (
        <div className="relative" ref={bellRef}>
             {/* Bell Icon */}
             <button 
                onClick={() => setOpen(!open)}
                className="relative p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
             >
                <svg className={`w-5 h-5 ${unread > 0 ? "text-white" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                
                {/* Badge */}
                {unread > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#050505] animate-pulse" />
                )}
             </button>

             {/* Dropdown */}
             {open && (
                 <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0b0c10] border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0d1017]">
                        <h3 className="text-sm font-bold text-white font-mono tracking-wide">Notifications</h3>
                        {unread > 0 && (
                            <button 
                                onClick={handleMarkAllRead}
                                className="text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        {loading ? (
                            <div className="p-8 flex justify-center">
                                <span className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-12 px-6 text-center">
                                <div className="mx-auto w-12 h-12 bg-gray-800/50 rounded-full flex items-center justify-center mb-3">
                                    <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                </div>
                                <p className="text-gray-500 text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            items.map(item => (
                                <div 
                                    key={item._id}
                                    onClick={(e) => handleItemClick(item)}
                                    className={`group px-4 py-3 border-b border-gray-800/50 cursor-pointer transition-all hover:bg-white/5 relative ${!item.read ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : ''}`}
                                >
                                    <div className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0">
                                            {getIcon(item.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-snug mb-1 ${!item.read ? 'text-gray-100 font-medium' : 'text-gray-400'}`}>
                                                {item.message}
                                            </p>
                                            <p className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">
                                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                         {!item.read && (
                                            <div className="self-center">
                                                 <span className="block w-2 h-2 bg-indigo-500 rounded-full" />
                                            </div>
                                         )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {/* Footer */}
                    {items.length > 0 && (
                        <div className="px-4 py-2 bg-[#0d1017] border-t border-gray-800 text-center">
                             <span className="text-[10px] text-gray-600">Showing last {items.length} notifications</span>
                        </div>
                    )}
                 </div>
             )}
        </div>
    );
};

export default NotificationsBell;