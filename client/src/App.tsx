import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./hooks/useAuth";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
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

const AuthLayout = ({ children }: { children: ReactNode }) => (
  <div className="auth-shell">
    <div className="brand-panel">
      <div className="brand-chip">DevCollab</div>
      <h1>Build together. Ship faster.</h1>
      <p>
        A focused workspace for modern engineering teams, pairing code, design,
        and releases into one flow.
      </p>
      <div className="brand-stats">
        <div>
          <span>99.98%</span>
          <small>service uptime</small>
        </div>
        <div>
          <span>24/7</span>
          <small>collaboration</small>
        </div>
      </div>
    </div>
    <div className="auth-card">{children}</div>
  </div>
);

const ProtectedLayout = ({ children }: { children: ReactNode }) => (
  <div className="app-shell">
    <Sidebar />
    <div className="app-body">
      <TopBar />
      <main className="app-main">{children}</main>
    </div>
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

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/login"
        element={
          <AuthLayout>
            <Login />
          </AuthLayout>
        }
      />
      <Route
        path="/signup"
        element={
          <AuthLayout>
            <Signup />
          </AuthLayout>
        }
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
