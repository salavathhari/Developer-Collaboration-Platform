import { useEffect, useState, useMemo } from "react";
import type { Project, ProjectInsight } from "../types";
import { generateProjectInsight, getLatestProjectInsight } from "../services/insightService";

const AnalyticsView = ({ project }: { project: Project }) => {
  const [insight, setInsight] = useState<ProjectInsight | null>(null);
  const [loading, setLoading] = useState(false);
  
  const projectId = project._id;
  
  const membersCount = useMemo(() => {
    // Count unique members + owner
    const s = new Set<string>();
    s.add(project.owner?._id || project.owner?.id || "owner");
    project.members?.forEach(m => s.add(m.user?._id || m.user?.id || `m-${Math.random()}`));
    return s.size;
  }, [project]);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      try {
        // First try to get existing, if null, generate
        let data = await getLatestProjectInsight(projectId);
        if (!data) {
           data = await generateProjectInsight(projectId, { windowDays: 7 });
        } else {
            // Check if it's old (e.g. > 1 hour) - for now just use it, but maybe trigger regenerate
            const age = Date.now() - new Date(data.createdAt).getTime();
            if (age > 3600000) { 
                // silently update in background
                generateProjectInsight(projectId, { windowDays: 7 }).then(res => setInsight(res)).catch(() => {});
            }
        }
        setInsight(data);
      } catch (err) {
        console.error("Failed to load insights", err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchInsights();
    }
  }, [projectId]);

  if (loading && !insight) {
      return <div className="p-12 text-center text-gray-500 font-mono">Loading analytics...</div>;
  }
  
  // Safe defaults
  const taskCounts = insight?.analytics?.taskCounts || { total: 0, byStatus: {}, byPriority: {}, completedLast7d: 0 };
  const activityCounts = insight?.analytics?.activityCounts || { total: 0, byType: {} };
  
  // Stats
  const totalTasks = taskCounts.total;
  const messagesSent = activityCounts.byType?.messageSent || 0;
  const filesUploaded = activityCounts.byType?.fileUploaded || 0;
  
  // Tasks breakdown
  const todoCount = taskCounts.byStatus?.todo || 0;
  const inProgressCount = (taskCounts.byStatus?.in_progress || 0) + (taskCounts.byStatus?.review || 0);
  const doneCount = taskCounts.byStatus?.done || 0;
  
  const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  // Pie Chart Data
  // Circumference = 2 * PI * R. Let R=40. C ~ 251.
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const todoPercent = totalTasks > 0 ? todoCount / totalTasks : 0;
  const progressPercent = totalTasks > 0 ? inProgressCount / totalTasks : 0;
  const donePercent = totalTasks > 0 ? doneCount / totalTasks : 0;
  
  const doneOffset = 0;
  const progressOffset = -1 * donePercent * circumference;
  const todoOffset = -1 * (donePercent + progressPercent) * circumference;

  // Bar Chart Data (Top Contributors)
  // insight.analytics.workloadByAssignee contains openTasks, overdueTasks
  // We'll map it to a simple array
  const contributors = (insight?.analytics?.workloadByAssignee || [])
    .sort((a, b) => (b.openTasks + b.overdueTasks) - (a.openTasks + a.overdueTasks))
    .slice(0, 5); // top 5
  
  // Calculate max scale
  const maxWorkload = Math.max(...contributors.map(c => c.openTasks + c.overdueTasks), 5); // at least 5 for scale

  return (
    <div className="h-full flex flex-col px-8 py-6 max-w-[1600px] mx-auto overflow-y-auto custom-scrollbar">
      <h2 className="text-2xl font-bold font-mono text-white tracking-tight mb-8">Analytics & Insights</h2>
      
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Team Members */}
        <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-6 relative group hover:border-indigo-500/30 transition-colors">
           <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
           </div>
           <div className="text-3xl font-bold text-white font-mono mb-1">{membersCount}</div>
           <div className="text-sm text-gray-400 font-mono">Team Members</div>
        </div>

        {/* Total Tasks */}
        <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-6 relative group hover:border-indigo-500/30 transition-colors">
           <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
           </div>
           <div className="text-3xl font-bold text-white font-mono mb-1">{totalTasks}</div>
           <div className="text-sm text-gray-400 font-mono">Total Tasks</div>
        </div>
        
        {/* Messages Sent */}
        <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-6 relative group hover:border-indigo-500/30 transition-colors">
           <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4 text-green-400">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
           </div>
           <div className="text-3xl font-bold text-white font-mono mb-1">{messagesSent}</div>
           <div className="text-sm text-gray-400 font-mono">Messages Sent</div>
        </div>

        {/* Files Uploaded */}
        <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-6 relative group hover:border-indigo-500/30 transition-colors">
           <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </div>
           <div className="text-3xl font-bold text-white font-mono mb-1">{filesUploaded}</div>
           <div className="text-sm text-gray-400 font-mono">Files Uploaded</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Task Distribution (Pie) */}
        <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-8 min-h-[400px]">
           <h3 className="text-lg font-bold text-white font-mono mb-8 flex items-center gap-2">
              <span className="text-blue-500">~</span> Task Distribution
           </h3>
           
           <div className="relative flex items-center justify-center h-64">
               {totalTasks === 0 ? (
                   <div className="text-gray-600 font-mono text-sm">No tasks data available</div>
               ) : (
                   <>
                       <svg viewBox="0 0 100 100" className="w-48 h-48 -rotate-90">
                            {/* Background Circle */}
                            <circle cx="50" cy="50" r={radius} fill="none" stroke="#161b22" strokeWidth="20" />
                            
                            {/* Done (Green) */}
                            {donePercent > 0 && (
                                <circle cx="50" cy="50" r={radius} fill="none" stroke="#22c55e" strokeWidth="20" 
                                        strokeDasharray={`${donePercent * circumference} ${circumference}`} 
                                        strokeDashoffset={doneOffset}
                                        className="transition-all duration-1000 ease-out"
                                />
                            )}
                            {/* Progress (Blue) */}
                            {progressPercent > 0 && (
                                <circle cx="50" cy="50" r={radius} fill="none" stroke="#3b82f6" strokeWidth="20" 
                                        strokeDasharray={`${progressPercent * circumference} ${circumference}`} 
                                        strokeDashoffset={progressOffset}
                                        className="transition-all duration-1000 ease-out"
                                />
                            )}
                            {/* Todo (Gray) */}
                            {todoPercent > 0 && (
                                <circle cx="50" cy="50" r={radius} fill="none" stroke="#9ca3af" strokeWidth="20" 
                                        strokeDasharray={`${todoPercent * circumference} ${circumference}`} 
                                        strokeDashoffset={todoOffset}
                                        className="transition-all duration-1000 ease-out"
                                />
                            )}
                       </svg>
                       <div className="absolute flex gap-8 pointer-events-none transform translate-y-24 mt-12 w-full justify-center text-xs font-mono">
                           <span className="flex items-center gap-1.5 text-gray-300">To Do: {todoCount}</span>
                           <span className="flex items-center gap-1.5 text-blue-400">Doing: {inProgressCount}</span>
                           <span className="flex items-center gap-1.5 text-green-400">Done: {doneCount}</span>
                       </div>
                   </>
               )}
           </div>
           
           <div className="text-center mt-6">
              <div className="text-gray-400 text-xs font-mono mb-1">Completion Rate</div>
              <div className="text-2xl font-bold text-green-500 font-mono">{completionRate}%</div>
           </div>
        </div>

        {/* Top Contributors (Bar) */}
        <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-8 min-h-[400px]">
           <h3 className="text-lg font-bold text-white font-mono mb-8 flex items-center gap-2">
              <span className="text-indigo-500">o</span> Top Contributors
           </h3>
           
           <div className="h-64 flex items-end justify-center px-4 gap-4 sm:gap-8 pb-6 border-b border-gray-800/50">
                {contributors.length === 0 ? (
                    <div className="text-gray-600 font-mono text-sm self-center">No contributor data</div>
                ) : (
                    contributors.map((c, i) => {
                        const total = c.openTasks + c.overdueTasks;
                        const heightPercent = totalTasks > 0 ? (total / maxWorkload) * 100 : 0;
                        return (
                            <div key={i} className="flex flex-col items-center gap-2 w-12 sm:w-16">
                                <div 
                                    className="w-full bg-green-500 hover:bg-green-400 transition-all rounded-t-sm"
                                    style={{ height: `${Math.max(heightPercent, 2)}%` }} // min height for visibility
                                />
                                <span className="text-xs text-gray-500 font-mono truncate w-full text-center">{c.name.split(' ')[0].toLowerCase()}</span>
                            </div>
                        )
                    })
                )}
           </div>
           
           <div className="mt-8 relative">
                {/* Y Axis Labels (Mock) */}
                <div className="absolute -left-0 -top-60 text-[10px] text-gray-600 font-mono flex flex-col gap-12 text-right pointer-events-none h-60 justify-between">
                     <span>1</span>
                     <span>0.75</span>
                     <span>0.5</span>
                     <span>0.25</span>
                     <span>0</span>
                </div>
           </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-8">
           <h3 className="text-lg font-bold text-white font-mono mb-6">Activity Summary</h3>
           
           <div className="space-y-4">
               <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                   <span className="text-gray-400 text-sm font-mono">Recent Activities (Last 7 Days)</span>
                   <span className="text-white font-bold font-mono">{activityCounts.total}</span>
               </div>
               <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                   <span className="text-gray-400 text-sm font-mono">Completed Tasks</span>
                   <span className="text-green-500 font-bold font-mono">{doneCount}</span>
               </div>
               <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                   <span className="text-gray-400 text-sm font-mono">Tasks In Progress</span>
                   <span className="text-blue-500 font-bold font-mono">{inProgressCount}</span>
               </div>
           </div>
           
           <div className="mt-6 flex justify-end">
           </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
