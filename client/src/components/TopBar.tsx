import { useEffect, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import NotificationsBell from "./NotificationsBell";

const TopBar = () => {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") || "light";
    setDarkMode(stored === "dark");
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="search-field">
          <span>Search</span>
          <input
            type="search"
            placeholder="Projects, tasks, messages"
            aria-label="Search"
          />
        </div>
      </div>
      <div className="topbar-actions">
        <button className="secondary-button light" type="button">
          New
        </button>
        <NotificationsBell />
        <button
          className="secondary-button light"
          type="button"
          onClick={toggleTheme}
        >
          {darkMode ? "Light" : "Dark"}
        </button>
        <div className="topbar-user">
          <span>{user?.name || "User"}</span>
          <small>{user?.role || "member"}</small>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
