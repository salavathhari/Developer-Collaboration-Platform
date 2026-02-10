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

export type TaskComment = {
  userId: User;
  text: string;
  createdAt: string;
};

export type ActivityEntry = {
  eventType: "created" | "status_changed" | "priority_changed" | "assigned" | "unassigned" | "pr_linked" | "file_linked" | "commented" | "due_date_set" | "description_updated";
  userId: User | string;
  timestamp: string;
  metadata?: Record<string, any>;
};

export type TaskAttachment = {
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedBy: User | string;
  uploadedAt: string;
};

export type Task = {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "critical";
  dueDate?: string;
  assignedTo?: User; // Legacy field for backwards compatibility
  assignees?: User[]; // New field: array of assigned users
  createdBy: User;
  labels?: string[];
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
  commentsCount?: number;
  orderKey?: number; // For drag-drop ordering within columns (fractional indexing)
  linkedPRs?: Array<{ _id: string; number: number; title: string; status: string }>; // Array of linked PRs
  linkedFiles?: Array<{ _id: string; filename: string; url: string }>; // Array of linked files
  linkedChatThreads?: string[]; // Array of chat message IDs
  estimatedHours?: number;
  isBlocked?: boolean;
  blockerReason?: string;
  activity?: ActivityEntry[]; // Activity log
  createdAt: string;
  updatedAt: string;
};

export type Column = {
  _id: string;
  name: string;
  projectId: string;
  order: number;
};


export type Notification = {
  _id: string;
  type: string;
  message: string;
  projectId?: string | null;
  referenceId?: string | null;
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
  priority: "low" | "medium" | "high" | "critical";
  status: "todo" | "in_progress" | "review" | "done";
  daysOverdue?: number;
  assignees?: User[];
};

export type TaskPriorityRecommendation = {
  taskId?: string;
  title?: string;
  recommendedPriority: "low" | "medium" | "high" | "critical";
  reason: string;
};


export type Repository = {
  _id: string;
  projectId: string;
  name: string;
  description?: string;
  owner: User;
  branches: {
      name: string;
      headCommit: string;
  }[];
  defaultBranch: string;
  createdAt: string;
};

export type Commit = {
  _id: string;
  repositoryId: string;
  author: User;
  message: string;
  branch: string;
  parentCommit?: string;
  stats: {
      additions: number;
      deletions: number;
  };
  createdAt: string;
};

export type FileNode = {
    path: string;
    type: 'file' | 'folder';
    content?: string;
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
    codeStats?: {
        commits: number;
        activeBranches: number;
        mergedPRs: number;
        avgMergeTimeHours: number;
    };
  };
  ai: {
    priorityRecommendations: TaskPriorityRecommendation[];
    productivityInsights: string[];
    dashboardSuggestions: string[];
  };
  createdAt: string;
};
