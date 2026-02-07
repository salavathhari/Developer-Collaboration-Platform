import { useEffect, useState } from "react";

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
    const data = await getNotifications();
    setItems(data.notifications);
    setUnread(data.unreadCount);
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handler = (notification: Notification) => {
      setItems((prev) => [notification, ...prev]);
      setUnread((prev) => prev + 1);
    };

    socket.on("notification", handler);
    return () => {
      socket.off("notification", handler);
    };
  }, [socket]);

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) =>
      prev.map((item) => (item._id === id ? { ...item, read: true } : item))
    );
    setUnread((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="notifications">
      <button className="secondary-button light" type="button" onClick={() => setOpen(!open)}>
        Alerts {unread > 0 ? `(${unread})` : ""}
      </button>
      {open ? (
        <div className="notifications-panel">
          {items.length === 0 ? (
            <p>No notifications.</p>
          ) : (
            items.map((item) => (
              <div key={item._id} className={item.read ? "notice" : "notice unread"}>
                <div>
                  <strong>{item.type}</strong>
                  <p>{JSON.stringify(item.payload)}</p>
                </div>
                {!item.read ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => handleRead(item._id)}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsBell;
