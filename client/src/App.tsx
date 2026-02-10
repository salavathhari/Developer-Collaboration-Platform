import { Navigate, Route, Routes, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getPullRequestById } from "./services/prService";
import { useAuth } from "./hooks/useAuth";
import TopBar from "./components/TopBar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import InviteAccept from "./pages/InviteAccept";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import ChatHub from "./pages/ChatHub";
import TasksHub from "./pages/TasksHub";
import FilesHub from "./pages/FilesHub";
import NotificationsHub from "./pages/NotificationsHub";
import "./App.css";

const ProtectedLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col min-h-screen bg-[#050505]">
    {/* <Sidebar />  Temporarily hidden to match requested design */}
    <TopBar />
    <main className="flex-1 overflow-auto">{children}</main>
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="state-card">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Redirector for PR deep links
const PrRedirect = () => {
    const { prId } = useParams();
    const navigate = useNavigate();
    
    useEffect(() => {
        const resolve = async () => {
            try {
                if(!prId) return;
                const pr = await getPullRequestById(prId);
                navigate(`/project/${pr.projectId}?tab=prs&prId=${prId}`, { replace: true });
            } catch(e) {
                console.error(e);
                navigate('/dashboard');
            }
        };
        resolve();
    }, [prId, navigate]);

    return <div className="p-10 text-center text-gray-500">Resolving PR location...</div>;
};

// Redirector for Pull Request List route
const PrListRedirect = () => {
    const { projectId } = useParams();
    return <Navigate to={`/project/${projectId}?tab=prs`} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={<Login />}
      />
      <Route
        path="/signup"
        element={<Signup />}
      />
      <Route path="/invite/:token" element={<InviteAccept />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      {/* Route for direct project PR list access */}
      <Route 
        path="/project/:projectId/pull-requests"
        element={
            <ProtectedRoute>
                <ProtectedLayout>
                    <PrListRedirect />
                </ProtectedLayout>
            </ProtectedRoute>
        }
      />
      {/* Route for direct PR deep link */}
      <Route
        path="/pr/:prId"
        element={
            <ProtectedRoute>
                <ProtectedLayout>
                    <PrRedirect />
                </ProtectedLayout>
            </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <ChatHub />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <TasksHub />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/files"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <FilesHub />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <NotificationsHub />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <ProjectWorkspace />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProtectedLayout>
              <Profile />
            </ProtectedLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
