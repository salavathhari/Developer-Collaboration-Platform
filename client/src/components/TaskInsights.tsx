import { useEffect, useState } from "react";

import type { ProjectInsight } from "../types";
import {
  generateProjectInsight,
  getLatestProjectInsight,
} from "../services/insightService";

type TaskInsightsProps = {
  projectId: string;
};

const TaskInsights = ({ projectId }: TaskInsightsProps) => {
  const [insight, setInsight] = useState<ProjectInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = async () => {
    setError(null);
    try {
      const data = await getLatestProjectInsight(projectId);
      setInsight(data);
    } catch (err) {
      setError("Unable to load insights.");
    }
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateProjectInsight(projectId);
      setInsight(data);
    } catch (err) {
      setError("Unable to generate insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, [projectId]);

  const taskCounts = insight?.analytics.taskCounts;

  return (
    <section className="task-insights">
      <header>
        <div>
          <h4>AI task recommendations</h4>
          <p>Analytics, priorities, and productivity signals.</p>
        </div>
        <button
          className="secondary-button light"
          onClick={generate}
          disabled={loading}
        >
          {loading ? "Generating..." : "Refresh insights"}
        </button>
      </header>

      {error ? <p className="form-alert error">{error}</p> : null}

      {!insight ? (
        <p className="insights-empty">
          No insights generated yet. Click refresh to analyze activity.
        </p>
      ) : (
        <div className="insights-grid">
          <div className="insights-card">
            <h5>Task pulse</h5>
            <div className="insights-metrics">
              <div>
                <span>{taskCounts?.total ?? 0}</span>
                <small>Total tasks</small>
              </div>
              <div>
                <span>{taskCounts?.completedLast7d ?? 0}</span>
                <small>Completed 7d</small>
              </div>
              <div>
                <span>{insight.analytics.overdueTasks.length}</span>
                <small>Overdue</small>
              </div>
            </div>
          </div>

          <div className="insights-card">
            <h5>Priority recommendations</h5>
            {insight.ai.priorityRecommendations.length === 0 ? (
              <p>No priority suggestions yet.</p>
            ) : (
              <ul>
                {insight.ai.priorityRecommendations.slice(0, 5).map((item, idx) => (
                  <li key={`${item.taskId || "task"}-${idx}`}>
                    <strong>{item.title || "Task"}</strong> - {item.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="insights-card">
            <h5>Overdue tasks</h5>
            {insight.analytics.overdueTasks.length === 0 ? (
              <p>No overdue tasks.</p>
            ) : (
              <ul>
                {insight.analytics.overdueTasks.slice(0, 5).map((task) => (
                  <li key={task.taskId || task.title}>
                    <strong>{task.title}</strong> ({task.daysOverdue}d overdue)
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="insights-card">
            <h5>Productivity insights</h5>
            {insight.ai.productivityInsights.length === 0 ? (
              <p>No insights yet.</p>
            ) : (
              <ul>
                {insight.ai.productivityInsights.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="insights-card">
            <h5>Dashboard visualization ideas</h5>
            {insight.ai.dashboardSuggestions.length === 0 ? (
              <p>No suggestions yet.</p>
            ) : (
              <ul>
                {insight.ai.dashboardSuggestions.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default TaskInsights;
