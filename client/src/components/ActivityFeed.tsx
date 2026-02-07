import { useEffect, useState } from "react";

import { getProjectActivity } from "../services/activityService";
import type { Activity } from "../types";

type ActivityFeedProps = {
  projectId: string;
};

const ActivityFeed = ({ projectId }: ActivityFeedProps) => {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await getProjectActivity(projectId);
      setItems(data);
    };

    load();
  }, [projectId]);

  return (
    <div className="activity-feed">
      <h4>Recent activity</h4>
      {items.length === 0 ? (
        <p>No recent activity.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item._id}>
              <strong>{item.actorId?.name || "User"}</strong> {item.type}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ActivityFeed;
