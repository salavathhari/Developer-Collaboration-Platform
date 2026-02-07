import { NavLink } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span>DevCollab</span>
        <small>Developer Platform</small>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `nav-link${isActive ? " active" : ""}`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `nav-link${isActive ? " active" : ""}`
          }
        >
          Projects
        </NavLink>
        <NavLink
          to="/chat"
          className={({ isActive }) =>
            `nav-link${isActive ? " active" : ""}`
          }
        >
          Chat
        </NavLink>
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `nav-link${isActive ? " active" : ""}`
          }
        >
          Tasks
        </NavLink>
        <NavLink
          to="/files"
          className={({ isActive }) =>
            `nav-link${isActive ? " active" : ""}`
          }
        >
          Files
        </NavLink>
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `nav-link${isActive ? " active" : ""}`
          }
        >
          Notifications
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `nav-link${isActive ? " active" : ""}`
          }
        >
          Profile
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span>{user?.name}</span>
          <small>{user?.role}</small>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          Log out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
