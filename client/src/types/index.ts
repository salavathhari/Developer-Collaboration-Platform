export type User = {
  _id?: string;
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  avatar?: string | null;
  bio?: string;
};

export type ProjectMember = {
  user: User;
  role: "owner" | "member";
  addedAt: string;
};

export type Project = {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  owner: User;
  members: ProjectMember[];
  createdAt: string;
};

export type FileAsset = {
  _id: string;
  id?: string;
  projectId: string;
  uploaderId?: User;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
};

export type Message = {
  _id: string;
  projectId: string;
  senderId: User;
  content: string;
  attachments: FileAsset[];
  reactions: Record<string, string>;
  readBy: string[];
  createdAt: string;
};

export type Task = {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  columnId?: string;
  order?: number;
  type?: "task" | "bug" | "feature";
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  assignees: User[];
  labels: string[];
  createdBy: User;
  comments: { authorId: string; content: string; createdAt: string }[];
  createdAt: string;
};

export type Column = {
  _id: string;
  name: string;
  projectId: string;
  order: number;
};

  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  assignees: User[];
  labels: string[];
  dueDate?: string | null;
  priority: "low" | "medium" | "high";
  comments: { authorId: User; content: string; createdAt: string }[];
  createdBy: User;
  createdAt: string;
};

export type Notification = {
  _id: string;
  type: string;
  projectId?: string | null;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: string;
};

export type Activity = {
  _id: string;
  projectId: string;
  actorId: User;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type TaskInsightRef = {
  taskId?: string;
  title: string;
  dueDate?: string | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "review" | "done";
  daysOverdue?: number;
  assignees?: User[];
};

export type TaskPriorityRecommendation = {
  taskId?: string;
  title?: string;
  recommendedPriority: "low" | "medium" | "high";
  reason: string;
};

export type ProjectInsight = {
  _id: string;
  projectId: string;
  windowStart: string;
  windowEnd: string;
  analytics: {
    taskCounts: {
      total: number;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      completedLast7d: number;
    };
    overdueTasks: TaskInsightRef[];
    dueSoonTasks: TaskInsightRef[];
    activityCounts: {
      total: number;
      byType: Record<string, number>;
    };
    workloadByAssignee: {
      userId: string;
      name: string;
      openTasks: number;
      overdueTasks: number;
    }[];
  };
  ai: {
    priorityRecommendations: TaskPriorityRecommendation[];
    productivityInsights: string[];
    dashboardSuggestions: string[];
  };
  createdAt: string;
};
